-- "Borrar todos mis datos" (/more/data). Excepción consciente y acotada a
-- la regla de soft-delete del proyecto: en las 44 tablas del esquema no
-- existe una sola policy de DELETE (sync-config.ts: "DELETE nunca se
-- expone por RLS, todo op de borrado del outbox se traduce a un UPDATE
-- que setea deleted_at") — correcto para borrar UN ítem, pero acá el
-- usuario pide borrar la TOTALIDAD de sus propios datos, definitivo, con
-- barra de progreso real. Eso necesita un DELETE real, así que la
-- excepción vive en una función SECURITY DEFINER nueva que valida el
-- permiso ella misma en vez de depender de una policy.
--
-- Alcance: todo lo que cuelga de household_id (financiero + catálogos
-- clonados del household) MENOS households/household_members/
-- household_invites/profiles (estructura y datos de registro, no "datos
-- cargados") y audit_log (append-only, nunca se purga — CLAUDE.md/
-- 01-arquitectura-datos.md § 7). El household queda vacío, no se borra —
-- evita forzar un re-onboarding.
--
-- Solo el owner (no admin/member/viewer) puede ejecutar esto — decisión
-- de producto: en un household compartido, la advertencia del cliente
-- nombra a los demás miembros, pero el chequeo real de permiso vive acá.

CREATE FUNCTION public.is_household_owner(h uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members m
    WHERE m.household_id = h
      AND m.profile_id = (SELECT auth.uid())
      AND m.role = 'owner'
      AND m.status = 'active'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_household_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_household_owner(uuid) TO authenticated;

-- 7 pasos, llamados en secuencia desde el cliente (una barra de progreso
-- real: cada paso es un round-trip, no un timer simulado). El orden entre
-- pasos importa — respeta las FK reales del esquema (ninguna tabla de
-- household tiene ON DELETE CASCADE salvo profiles→auth.users, así que el
-- orden lo resuelve esta función a mano) — no reordenar sin revisar las
-- referencias cruzadas documentadas abajo. Cada paso es idempotente
-- (correrlo dos veces no rompe nada): un reintento después de un error
-- retoma desde el paso que falló, nunca desde el principio.
CREATE FUNCTION public.purge_household_step(p_household_id uuid, p_step text)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted bigint := 0;
  v_count bigint;
BEGIN
  IF NOT public.is_household_owner(p_household_id) THEN
    RAISE EXCEPTION 'Solo el owner del household puede borrar sus datos';
  END IF;

  IF p_step = 'transactions' THEN
    -- Prep: desvincula referencias opcionales (nullable) que apuntan a
    -- filas que se van a borrar en pasos posteriores — así el orden entre
    -- los 7 pasos no depende de que cada FK nullable esté resuelta en el
    -- momento exacto. Los únicos que quedan sin nullificar son NOT NULL
    -- (transactions.account_id, recurring_rules.account_id,
    -- card_statements.account_id, account_balance_snapshots.account_id,
    -- trades.portfolio_id/instrument_id, price_snapshots.instrument_id,
    -- debt_schedule.debt_id) — esos se resuelven con el ORDEN de los
    -- pasos (transactions/investments/recurring_debts/budgets_goals antes
    -- que accounts; hijos antes que padres dentro de cada paso).
    UPDATE public.debts SET origin_transaction_id = NULL, account_id = NULL WHERE household_id = p_household_id;
    UPDATE public.debt_schedule SET transaction_id = NULL
      WHERE debt_id IN (SELECT id FROM public.debts WHERE household_id = p_household_id);
    UPDATE public.card_statements SET settlement_transaction_id = NULL
      WHERE account_id IN (SELECT id FROM public.accounts WHERE household_id = p_household_id);
    UPDATE public.trades SET settlement_account_id = NULL
      WHERE portfolio_id IN (SELECT id FROM public.portfolios WHERE household_id = p_household_id);
    UPDATE public.portfolios SET broker_account_id = NULL WHERE household_id = p_household_id;
    UPDATE public.goals SET account_id = NULL WHERE household_id = p_household_id;
    UPDATE public.payees SET default_account_id = NULL, default_category_id = NULL WHERE household_id = p_household_id;
    UPDATE public.accounts SET institution_id = NULL WHERE household_id = p_household_id;
    UPDATE public.instruments SET asset_class_id = NULL WHERE household_id = p_household_id;
    UPDATE public.budgets SET category_id = NULL WHERE household_id = p_household_id;
    UPDATE public.recurring_rules SET category_id = NULL WHERE household_id = p_household_id;

    DELETE FROM public.transaction_shares
      WHERE transaction_id IN (SELECT id FROM public.transactions WHERE household_id = p_household_id);
    DELETE FROM public.transaction_splits
      WHERE transaction_id IN (SELECT id FROM public.transactions WHERE household_id = p_household_id);
    DELETE FROM public.transaction_tags
      WHERE transaction_id IN (SELECT id FROM public.transactions WHERE household_id = p_household_id);
    DELETE FROM public.settlements WHERE household_id = p_household_id;
    DELETE FROM public.transactions WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

  ELSIF p_step = 'investments' THEN
    DELETE FROM public.trades
      WHERE portfolio_id IN (SELECT id FROM public.portfolios WHERE household_id = p_household_id);
    DELETE FROM public.target_allocations
      WHERE portfolio_id IN (SELECT id FROM public.portfolios WHERE household_id = p_household_id);
    DELETE FROM public.portfolio_snapshots
      WHERE portfolio_id IN (SELECT id FROM public.portfolios WHERE household_id = p_household_id);
    DELETE FROM public.price_snapshots
      WHERE instrument_id IN (SELECT id FROM public.instruments WHERE household_id = p_household_id);
    DELETE FROM public.portfolios WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    DELETE FROM public.instruments WHERE household_id = p_household_id;
    DELETE FROM public.asset_classes WHERE household_id = p_household_id;

  ELSIF p_step = 'recurring_debts' THEN
    DELETE FROM public.debt_schedule
      WHERE debt_id IN (SELECT id FROM public.debts WHERE household_id = p_household_id);
    DELETE FROM public.debts WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    DELETE FROM public.recurring_rules WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted + v_count;

  ELSIF p_step = 'budgets_goals' THEN
    DELETE FROM public.budgets WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    DELETE FROM public.goals WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted + v_count;

  ELSIF p_step = 'accounts' THEN
    DELETE FROM public.card_statements
      WHERE account_id IN (SELECT id FROM public.accounts WHERE household_id = p_household_id);
    DELETE FROM public.account_balance_snapshots
      WHERE account_id IN (SELECT id FROM public.accounts WHERE household_id = p_household_id);
    DELETE FROM public.accounts WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

  ELSIF p_step = 'categories_rules' THEN
    DELETE FROM public.payees WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    DELETE FROM public.categories WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted + v_count;
    DELETE FROM public.tags WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted + v_count;
    DELETE FROM public.rules WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted + v_count;
    DELETE FROM public.insights WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted + v_count;

  ELSIF p_step = 'fx_prefs' THEN
    DELETE FROM public.fx_overrides WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    DELETE FROM public.household_fx_preferences WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted + v_count;
    DELETE FROM public.notification_preferences WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted + v_count;
    DELETE FROM public.import_batches WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted + v_count;
    DELETE FROM public.visibility_grants WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted + v_count;
    -- Clones del household únicamente — nunca las filas globales
    -- (household_id IS NULL) del catálogo compartido.
    DELETE FROM public.institutions WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted + v_count;

  ELSE
    RAISE EXCEPTION 'Paso de borrado desconocido: %', p_step;
  END IF;

  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_household_step(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_household_step(uuid, text) TO authenticated;
