-- Bug crítico encontrado corriendo los tests de GATE-1 contra el proyecto
-- real (docs/plan-de-trabajo.md § 5.1): Postgres exige que la fila
-- RESULTANTE de un UPDATE también satisfaga la política de SELECT de la
-- tabla, no solo el WITH CHECK de la política de UPDATE. Como el borrado
-- de este esquema es "UPDATE ... SET deleted_at = now()" (nunca DELETE) y
-- las políticas de SELECT tenían `deleted_at IS NULL`, la fila recién
-- borrada deja de pasar su PROPIA política de SELECT y Postgres rechaza el
-- UPDATE con "new row violates row-level security policy" — el soft-delete
-- estaba roto en las 13 tablas que usan este patrón, verificado
-- empíricamente: con `WITH CHECK (true)` seguía fallando, y sacando
-- `deleted_at IS NULL` de la política de SELECT, el soft-delete funcionó.
--
-- Decisión (confirmada con el usuario): `deleted_at IS NULL` sale de RLS.
-- RLS asegura el aislamiento por household/visibilidad — no le corresponde
-- filtrar soft-deletes, que es una decisión de qué mostrar, no de quién
-- puede ver qué. Toda query de la app que no quiera ver borrados agrega
-- `.eq('deleted_at', null)` explícitamente — documentado en CLAUDE.md.
--
-- Nota importante: donde `deleted_at IS NULL` aparece sobre una tabla
-- PADRE dentro de un EXISTS (ej. `t.deleted_at IS NULL` en
-- transaction_splits_select, chequeando la transacción padre) NO se toca:
-- ese caso no es el bug — actualizar la fila hija no cambia el
-- `deleted_at` del padre, así que no hay auto-referencia y ese filtro sigue
-- siendo una decisión de producto válida (un hijo de un padre borrado no
-- se lista). Solo se saca el `deleted_at IS NULL` sobre la PROPIA fila de
-- cada política.

ALTER POLICY accounts_select ON public.accounts
USING (
  household_id IN (SELECT public.current_households())
  AND public.can_see('account', id, visibility, owner_id)
);

-- A2 (auditoría técnica) — `budgets` se reescribió a v2 en
-- `20260801010900_budgets_goals.sql`: ya no tiene `scope`/`owner_id` (v2 no
-- distingue presupuesto personal/household), así que esta política queda
-- igual de simple que `goals_select`/`recurring_rules_select` de abajo —
-- de hecho ya nace así en la migración v2, este ALTER es un no-op para
-- una cadena aplicada desde cero, y solo importa para el remoto que tenía
-- la v1 (ver `20260801110000_reconcile_budgets_goals_recurring_v2.sql`).
ALTER POLICY budgets_select ON public.budgets
USING (household_id IN (SELECT public.current_households()));

ALTER POLICY categories_select ON public.categories
USING (
  household_id IN (SELECT public.current_households())
  AND public.can_see('category', id, visibility, owner_id)
);

ALTER POLICY debts_select ON public.debts
USING (household_id IN (SELECT public.current_households()));

ALTER POLICY goals_select ON public.goals
USING (household_id IN (SELECT public.current_households()));

ALTER POLICY portfolios_select ON public.portfolios
USING (
  household_id IN (SELECT public.current_households())
  AND (visibility = 'household' OR created_by = (SELECT auth.uid()))
);

ALTER POLICY recurring_rules_select ON public.recurring_rules
USING (household_id IN (SELECT public.current_households()));

ALTER POLICY rules_select ON public.rules
USING (household_id IN (SELECT public.current_households()));

ALTER POLICY settlements_select ON public.settlements
USING (household_id IN (SELECT public.current_households()));

ALTER POLICY trades_select ON public.trades
USING (
  EXISTS (
    SELECT 1 FROM public.portfolios p
    WHERE p.id = trades.portfolio_id
      AND p.deleted_at IS NULL -- del padre, no de esta fila: se mantiene
      AND p.household_id IN (SELECT public.current_households())
      AND (p.visibility = 'household' OR p.created_by = (SELECT auth.uid()))
  )
);

ALTER POLICY transaction_shares_select ON public.transaction_shares
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_shares.transaction_id
      AND t.household_id IN (SELECT public.current_households())
      AND t.deleted_at IS NULL -- del padre, no de esta fila: se mantiene
  )
);

ALTER POLICY transaction_splits_select ON public.transaction_splits
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_splits.transaction_id
      AND t.household_id IN (SELECT public.current_households())
      AND t.deleted_at IS NULL -- del padre, no de esta fila: se mantiene
  )
);

ALTER POLICY tx_select ON public.transactions
USING (
  household_id IN (SELECT public.current_households())
  AND (visibility = 'household' OR created_by = (SELECT auth.uid()))
  -- una cuenta privada oculta sus transacciones aunque la transacción sea household
  AND EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.id = transactions.account_id
      AND public.can_see('account', a.id, a.visibility, a.owner_id)
  )
);
