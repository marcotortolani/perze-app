-- Continuación de 20260801020100: las mismas 3 políticas de hijas que
-- quedaron con `<padre>.deleted_at IS NULL` en su USING, encontradas
-- escribiendo el test de GATE-1 para portfolios/trades. Mismo criterio:
-- RLS no filtra por deleted_at en ningún lado, ni de la fila propia ni de
-- un padre — es responsabilidad de la capa de queries de la app.
ALTER POLICY target_allocations_all ON public.target_allocations
USING (
  EXISTS (
    SELECT 1 FROM public.portfolios p
    WHERE p.id = target_allocations.portfolio_id
      AND p.household_id IN (SELECT public.current_households())
  )
);

ALTER POLICY portfolio_snapshots_all ON public.portfolio_snapshots
USING (
  EXISTS (
    SELECT 1 FROM public.portfolios p
    WHERE p.id = portfolio_snapshots.portfolio_id
      AND p.household_id IN (SELECT public.current_households())
  )
);

ALTER POLICY account_balance_snapshots_all ON public.account_balance_snapshots
USING (
  EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = account_balance_snapshots.account_id
      AND a.household_id IN (SELECT public.current_households())
      AND public.can_see('account', a.id, a.visibility, a.owner_id)
  )
);

ALTER POLICY transaction_tags_all ON public.transaction_tags
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_tags.transaction_id
      AND t.household_id IN (SELECT public.current_households())
  )
);
