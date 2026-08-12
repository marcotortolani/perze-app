-- Gap encontrado al mergear la Tanda 4 (tarjeta multi-moneda) con el purge
-- de `20260804000000_purge_household.sql`: ese archivo es anterior a
-- `account_groups` (`20260812090000_...sql`), así que el paso 'accounts'
-- de `purge_household_step()` nunca la borraba — "Borrar todos mis datos"
-- dejaba filas de `account_groups` huérfanas en el servidor (sin ninguna
-- cuenta que las referencie). No corrompe nada ni viola RLS (siguen
-- acotadas al household, invisibles para cualquier otro), pero es basura
-- que el borrado "de todos mis datos" prometía no dejar. Mismo fix del
-- lado del cliente en `purge-household-local.ts` (Dexie).
CREATE OR REPLACE FUNCTION public.purge_household_step(p_household_id uuid, p_step text)
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
    -- Tanda 4 — el fix de esta migración: sin esto, el grupo de una
    -- tarjeta multi-moneda sobrevivía sin ninguna cuenta que lo referencie.
    DELETE FROM public.account_groups WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted + v_count;

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
