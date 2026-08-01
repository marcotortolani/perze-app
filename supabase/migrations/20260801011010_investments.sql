-- 01-arquitectura-datos.md § 2.8. portfolios es raíz (Patrón A); trades,
-- target_allocations y portfolio_snapshots son hijas (Patrón B) de
-- portfolios. price_snapshots es dato de mercado, no de household —
-- Patrón C puro, igual que fx_rates.
--
-- NOTA — gap de documentación: docs/plan-de-trabajo.md § 5.1 (MIG-10) menciona
-- además `instrument_cashflows`, `benchmarks`/`benchmark_series` y las vistas
-- `positions`/`fx_latest`, pero ninguno tiene schema escrito en
-- docs/01-arquitectura-datos.md § 2.8. No se inventan acá: instrument_cashflows
-- alimenta XIRR (CONS-I11) y benchmarks alimenta I10 — ambos bloqueados hasta
-- que se defina su forma. Las vistas positions/fx_latest se escriben una vez
-- que se sepa exactamente qué columnas necesita I3 (posiciones) — no antes.
CREATE TABLE public.portfolios (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  name text NOT NULL,
  base_currency text NOT NULL REFERENCES public.currencies (code),
  broker_account_id uuid REFERENCES public.accounts (id),
  visibility text NOT NULL DEFAULT 'household' CHECK (visibility IN ('household', 'private')),

  created_by uuid NOT NULL REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY portfolios_select ON public.portfolios FOR SELECT
USING (
  deleted_at IS NULL
  AND household_id IN (SELECT public.current_households())
  AND (visibility = 'household' OR created_by = (SELECT auth.uid()))
);

CREATE POLICY portfolios_insert ON public.portfolios FOR INSERT
WITH CHECK (public.can_write(household_id) AND created_by = (SELECT auth.uid()));

CREATE POLICY portfolios_update ON public.portfolios FOR UPDATE
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (
  household_id = (SELECT portfolios.household_id) -- inmutable, ver nota en accounts_update
  AND created_by = (SELECT portfolios.created_by)
);

CREATE TABLE public.trades (
  id uuid PRIMARY KEY,
  portfolio_id uuid NOT NULL REFERENCES public.portfolios (id),
  instrument_id uuid NOT NULL REFERENCES public.instruments (id),
  created_by uuid NOT NULL REFERENCES public.profiles (id),
  kind text NOT NULL CHECK (kind IN (
    'buy', 'sell', 'dividend', 'coupon', 'amortization', 'interest',
    'split', 'merger', 'fee', 'tax', 'deposit', 'withdrawal',
    'transfer_in', 'transfer_out', 'revaluation'
  )),
  executed_at timestamptz NOT NULL,
  quantity numeric(38, 12) NOT NULL,
  price numeric(38, 12) NOT NULL,
  currency_code text NOT NULL REFERENCES public.currencies (code),
  -- importes en bigint (unidades mínimas), igual que en el resto del
  -- sistema. quantity y price son numeric porque son cantidades, no plata.
  fees bigint NOT NULL DEFAULT 0,
  taxes bigint NOT NULL DEFAULT 0,
  gross_amount bigint NOT NULL,
  net_amount bigint NOT NULL,
  settlement_account_id uuid REFERENCES public.accounts (id), -- de qué cuenta salió/entró la plata

  -- misma forma que transactions: una operación en USD sin cotización se
  -- guarda igual, sin conversión. Sin esto, inversiones nace violando needs_fx.
  fx_rate numeric(24, 12),
  fx_source text NOT NULL DEFAULT 'identity' CHECK (
    fx_source IN ('identity', 'api', 'manual', 'inherited', 'pending')
  ),
  fx_resolved_at timestamptz,
  amount_base bigint,
  CONSTRAINT trades_fx_pair CHECK ((fx_rate IS NULL) = (amount_base IS NULL)),

  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX trades_portfolio_executed_idx ON public.trades (portfolio_id, executed_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX trades_instrument_executed_idx ON public.trades (instrument_id, executed_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- DELETE no se expone (mismo criterio que transaction_splits/shares, CON-24).
CREATE POLICY trades_select ON public.trades FOR SELECT
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.portfolios p
    WHERE p.id = trades.portfolio_id
      AND p.deleted_at IS NULL
      AND p.household_id IN (SELECT public.current_households())
      AND (p.visibility = 'household' OR p.created_by = (SELECT auth.uid()))
  )
);

CREATE POLICY trades_insert ON public.trades FOR INSERT
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.portfolios p
    WHERE p.id = trades.portfolio_id AND public.can_write(p.household_id)
  )
);

CREATE POLICY trades_update ON public.trades FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.portfolios p
    WHERE p.id = trades.portfolio_id AND public.can_write(p.household_id)
  )
)
WITH CHECK (
  created_by = (SELECT trades.created_by)
  AND portfolio_id = (SELECT trades.portfolio_id) -- inmutable: sin esto, un miembro con acceso a dos households podría mover el trade de un portfolio a otro
  AND EXISTS (
    SELECT 1 FROM public.portfolios p
    WHERE p.id = trades.portfolio_id AND public.can_write(p.household_id)
  )
);

-- Dato de mercado, no de household — mismo Patrón C puro que fx_rates:
-- lectura para todo autenticado, escritura solo por cron/Edge Functions
-- (service_role bypassea RLS).
CREATE TABLE public.price_snapshots (
  instrument_id uuid NOT NULL REFERENCES public.instruments (id),
  as_of date NOT NULL,
  provider text NOT NULL,
  close numeric(38, 12) NOT NULL,
  currency_code text NOT NULL REFERENCES public.currencies (code),
  open numeric(38, 12),
  high numeric(38, 12),
  low numeric(38, 12),
  volume numeric(38, 4),
  PRIMARY KEY (instrument_id, as_of, provider)
);

CREATE INDEX price_snapshots_instrument_idx ON public.price_snapshots (instrument_id, as_of DESC);

ALTER TABLE public.price_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY price_snapshots_select ON public.price_snapshots FOR SELECT
USING (true);

CREATE TABLE public.target_allocations (
  id uuid PRIMARY KEY,
  portfolio_id uuid NOT NULL REFERENCES public.portfolios (id),
  dimension text NOT NULL CHECK (dimension IN ('asset_class', 'currency', 'country', 'instrument', 'sector')),
  key text NOT NULL,
  target_pct numeric(6, 3) NOT NULL,
  band_pct numeric(6, 3) NOT NULL DEFAULT 5
);

CREATE INDEX target_allocations_portfolio_idx ON public.target_allocations (portfolio_id);

ALTER TABLE public.target_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY target_allocations_all ON public.target_allocations FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.portfolios p
    WHERE p.id = target_allocations.portfolio_id
      AND p.deleted_at IS NULL
      AND p.household_id IN (SELECT public.current_households())
  )
)
WITH CHECK (
  portfolio_id = (SELECT target_allocations.portfolio_id) -- inmutable, ver nota en accounts_update
  AND EXISTS (
    SELECT 1 FROM public.portfolios p
    WHERE p.id = target_allocations.portfolio_id AND public.can_write(p.household_id)
  )
);

CREATE TABLE public.portfolio_snapshots ( -- para TWR y gráficos históricos
  portfolio_id uuid NOT NULL REFERENCES public.portfolios (id),
  as_of date NOT NULL,
  market_value bigint NOT NULL,
  cost_basis bigint NOT NULL,
  cash_flow bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (portfolio_id, as_of)
);

ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY portfolio_snapshots_all ON public.portfolio_snapshots FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.portfolios p
    WHERE p.id = portfolio_snapshots.portfolio_id
      AND p.deleted_at IS NULL
      AND p.household_id IN (SELECT public.current_households())
  )
)
WITH CHECK (
  portfolio_id = (SELECT portfolio_snapshots.portfolio_id) -- inmutable, ver nota en accounts_update
  AND EXISTS (
    SELECT 1 FROM public.portfolios p
    WHERE p.id = portfolio_snapshots.portfolio_id AND public.can_write(p.household_id)
  )
);
