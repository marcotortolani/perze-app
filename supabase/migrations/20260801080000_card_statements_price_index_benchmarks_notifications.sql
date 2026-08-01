-- Cierra los gaps de schema documentados en 20260801011100_system.sql:
-- card_statements (E4), price_index (H7), benchmarks/benchmark_series (I10),
-- notification_preferences + push_subscriptions (K12).
--
-- `instrument_cashflows` (I11, XIRR) NO se crea: es un gap falso. `trades`
-- ya tiene `executed_at`/`net_amount`/`amount_base` con needs_fx completo —
-- XIRR se deriva de esas filas (signo por `kind`) más el valor de mercado
-- actual de la posición (`price_snapshots`/`computePositions`), no necesita
-- una tabla nueva. Se documenta acá para que nadie la reinvente.

-- E4 — resumen de tarjeta. Hija de accounts (Patrón B): un household ve sus
-- resúmenes por EXISTS sobre la cuenta, sin household_id duplicado.
CREATE TABLE public.card_statements (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts (id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  closing_date date NOT NULL,
  due_date date NOT NULL,
  statement_balance bigint NOT NULL,
  minimum_payment bigint,
  currency_code text NOT NULL REFERENCES public.currencies (code),
  paid_amount bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paid', 'overdue')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX card_statements_account_idx ON public.card_statements (account_id, period_start DESC);

ALTER TABLE public.card_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY card_statements_all ON public.card_statements FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = card_statements.account_id AND a.household_id IN (SELECT public.current_households())
  )
)
WITH CHECK (
  account_id = (SELECT card_statements.account_id) -- inmutable, mismo criterio que el resto de las hijas
  AND EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = card_statements.account_id AND public.can_write(a.household_id)
  )
);

-- H7 — índice de precios para "gasto en moneda constante". Catálogo global
-- (Patrón C): lectura para todo autenticado, escritura solo por seeds/Edge
-- Functions (cron que carga el IPC/CPI mensual), igual que currencies.
CREATE TABLE public.price_index (
  id uuid PRIMARY KEY,
  currency_code text NOT NULL REFERENCES public.currencies (code),
  period date NOT NULL, -- primer día del mes
  index_value numeric(24, 12) NOT NULL, -- número índice, no plata — nunca bigint
  source text NOT NULL DEFAULT 'manual',
  UNIQUE (currency_code, period)
);

CREATE INDEX price_index_currency_idx ON public.price_index (currency_code, period DESC);

ALTER TABLE public.price_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY price_index_select ON public.price_index FOR SELECT
USING (true);

-- I10 — benchmarks para comparar rendimiento de portfolio. Catálogo global
-- (Patrón C), misma forma que instruments/price_snapshots.
CREATE TABLE public.benchmarks (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  symbol text NOT NULL UNIQUE,
  currency_code text NOT NULL REFERENCES public.currencies (code)
);

ALTER TABLE public.benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY benchmarks_select ON public.benchmarks FOR SELECT
USING (true);

CREATE TABLE public.benchmark_series (
  benchmark_id uuid NOT NULL REFERENCES public.benchmarks (id),
  as_of date NOT NULL,
  close numeric(24, 12) NOT NULL,
  PRIMARY KEY (benchmark_id, as_of)
);

CREATE INDEX benchmark_series_benchmark_idx ON public.benchmark_series (benchmark_id, as_of DESC);

ALTER TABLE public.benchmark_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY benchmark_series_select ON public.benchmark_series FOR SELECT
USING (true);

-- K12 — preferencias de notificación, una fila por miembro (no por
-- household: cada uno decide las suyas). RLS restringe a la fila propia,
-- no a `can_write` del household — nadie configura las notificaciones de
-- otro miembro aunque sea admin.
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  profile_id uuid NOT NULL REFERENCES public.profiles (id),
  budget_alerts boolean NOT NULL DEFAULT true,
  weekly_summary boolean NOT NULL DEFAULT true,
  recurring_reminders boolean NOT NULL DEFAULT true,
  insights boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, profile_id)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_preferences_all ON public.notification_preferences FOR ALL
USING (profile_id = (SELECT auth.uid()) AND household_id IN (SELECT public.current_households()))
WITH CHECK (profile_id = (SELECT auth.uid()) AND household_id IN (SELECT public.current_households()));

-- Credenciales de push por dispositivo — dato de sesión del navegador, no
-- de producto: nunca visible para otro miembro del household, ni siquiera
-- un admin.
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles (id),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_subscriptions_all ON public.push_subscriptions FOR ALL
USING (profile_id = (SELECT auth.uid()))
WITH CHECK (profile_id = (SELECT auth.uid()));
