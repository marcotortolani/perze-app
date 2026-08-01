-- Continuación de 20260801020000_fix_soft_delete_rls.sql, encontrada
-- escribiendo los tests de GATE-1 para debt_schedule: aunque el chequeo de
-- `deleted_at IS NULL` sobre una tabla PADRE (dentro de un EXISTS en una
-- policy de tabla hija) no causa el bug de auto-referencia del UPDATE
-- (actualizar la hija no cambia el deleted_at del padre), sigue violando la
-- misma decisión de arquitectura ya tomada: RLS no filtra por deleted_at,
-- eso es responsabilidad de la capa de queries de la app. Dejarlo solo en
-- las políticas de hijas es inconsistente — un debt_schedule de una deuda
-- recién soft-deleteada se volvía invisible por RLS (verificado con test),
-- mientras que la deuda misma (con el fix anterior) seguía siendo visible.
-- Se saca acá para las 5 policies que quedaron con el chequeo del padre:
-- transaction_splits_select, transaction_shares_select, budget_lines_select,
-- debt_schedule_all, trades_select.

ALTER POLICY transaction_splits_select ON public.transaction_splits
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_splits.transaction_id
      AND t.household_id IN (SELECT public.current_households())
  )
);

ALTER POLICY transaction_shares_select ON public.transaction_shares
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_shares.transaction_id
      AND t.household_id IN (SELECT public.current_households())
  )
);

ALTER POLICY budget_lines_select ON public.budget_lines
USING (
  EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = budget_lines.budget_id
      AND b.household_id IN (SELECT public.current_households())
      AND (b.scope = 'household' OR b.owner_id = (SELECT auth.uid()))
  )
);

ALTER POLICY debt_schedule_all ON public.debt_schedule
USING (
  EXISTS (
    SELECT 1 FROM public.debts d
    WHERE d.id = debt_schedule.debt_id
      AND d.household_id IN (SELECT public.current_households())
  )
);

ALTER POLICY trades_select ON public.trades
USING (
  EXISTS (
    SELECT 1 FROM public.portfolios p
    WHERE p.id = trades.portfolio_id
      AND p.household_id IN (SELECT public.current_households())
      AND (p.visibility = 'household' OR p.created_by = (SELECT auth.uid()))
  )
);
