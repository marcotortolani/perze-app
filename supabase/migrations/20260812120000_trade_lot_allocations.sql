-- Fase 2 de la revisión de inversiones (ver CHANGELOG v0.31.2/0.31.3): elegir
-- qué lote se vende, no solo consumir FIFO en runtime.
--
-- Hija de `trades` (Patrón B), sin `household_id` propio — RLS por `EXISTS`
-- sobre `trades` → `portfolios`, mismo criterio que `target_allocations`/
-- `portfolio_snapshots` en 20260801011010_investments.sql. DELETE no se
-- expone (mismo criterio que `transaction_splits`/`transaction_shares`,
-- CON-24): se soft-delete con `deleted_at`.
--
-- Una venta SIN filas acá cae a FIFO en `computeLots()` — así todas las
-- ventas ya cargadas antes de esta migración siguen funcionando sin migrar
-- datos, y FIFO queda como default permanente, no como estado transitorio.
CREATE TABLE public.trade_lot_allocations (
  id uuid PRIMARY KEY,
  sell_trade_id uuid NOT NULL REFERENCES public.trades (id),
  buy_trade_id uuid NOT NULL REFERENCES public.trades (id),
  quantity numeric(38, 12) NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT trade_lot_allocations_distinct_trades CHECK (sell_trade_id <> buy_trade_id)
);

CREATE INDEX trade_lot_allocations_sell_idx ON public.trade_lot_allocations (sell_trade_id) WHERE deleted_at IS NULL;
CREATE INDEX trade_lot_allocations_buy_idx ON public.trade_lot_allocations (buy_trade_id) WHERE deleted_at IS NULL;

ALTER TABLE public.trade_lot_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY trade_lot_allocations_select ON public.trade_lot_allocations FOR SELECT
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.trades tr
    JOIN public.portfolios p ON p.id = tr.portfolio_id
    WHERE tr.id = trade_lot_allocations.sell_trade_id
      AND tr.deleted_at IS NULL
      AND p.deleted_at IS NULL
      AND p.household_id IN (SELECT public.current_households())
      AND (p.visibility = 'household' OR p.created_by = (SELECT auth.uid()))
  )
);

CREATE POLICY trade_lot_allocations_insert ON public.trade_lot_allocations FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.trades tr
    JOIN public.portfolios p ON p.id = tr.portfolio_id
    WHERE tr.id = trade_lot_allocations.sell_trade_id AND public.can_write(p.household_id)
  )
  AND EXISTS (
    SELECT 1 FROM public.trades tr
    JOIN public.portfolios p ON p.id = tr.portfolio_id
    WHERE tr.id = trade_lot_allocations.buy_trade_id AND public.can_write(p.household_id)
  )
);

CREATE POLICY trade_lot_allocations_update ON public.trade_lot_allocations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.trades tr
    JOIN public.portfolios p ON p.id = tr.portfolio_id
    WHERE tr.id = trade_lot_allocations.sell_trade_id AND public.can_write(p.household_id)
  )
)
WITH CHECK (
  sell_trade_id = (SELECT trade_lot_allocations.sell_trade_id) -- inmutable
  AND buy_trade_id = (SELECT trade_lot_allocations.buy_trade_id) -- inmutable: se soft-delete y se crea otra, no se reasigna a otro lote
  AND EXISTS (
    SELECT 1 FROM public.trades tr
    JOIN public.portfolios p ON p.id = tr.portfolio_id
    WHERE tr.id = trade_lot_allocations.sell_trade_id AND public.can_write(p.household_id)
  )
);
