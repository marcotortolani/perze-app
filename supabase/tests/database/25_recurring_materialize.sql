-- Recurrentes v3 — el resto de la cobertura de `materialize_recurring_transactions`
-- que 21_cron_engines.sql no cubre: el tope de 6 por corrida, que una
-- ocurrencia deshecha (soft-delete) no se recrea, y que el índice único de
-- idempotencia rechaza un duplicado manual con 23505.
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(3));

SELECT tests.clear_authentication();
SELECT tests.setup_household('rm', 'recurring-materialize-household');

SELECT tests.stash('rm_account_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, opening_balance, created_by)
VALUES (tests.get('rm_account_id'), tests.get('rm_household_id'), tests.get('rm_profile_id'), 'Efectivo', 'cash', 'ARS', 0, tests.get('rm_profile_id'));

-- Regla semanal anclada hace 3 meses (~13 ocurrencias posibles hasta hoy):
-- el tope de 6 por corrida hace falta más de una corrida para ponerse al día.
SELECT tests.stash('rm_weekly_id', gen_random_uuid());
INSERT INTO public.recurring_rules (id, household_id, name, kind, account_id, expected_amount, currency_code, frequency, anchor_date, day_of_month, auto_post, created_by)
VALUES (
  tests.get('rm_weekly_id'), tests.get('rm_household_id'), 'Pedidos Ya', 'expense', tests.get('rm_account_id'), 10000, 'ARS',
  'weekly', current_date - interval '13 weeks', NULL, true, tests.get('rm_profile_id')
);

SELECT public.materialize_recurring_transactions();
SELECT tests.log(cmp_ok(
  (SELECT count(*)::int FROM public.transactions WHERE recurring_id = tests.get('rm_weekly_id')),
  '<=', 6,
  'una sola corrida nunca crea más de 6 ocurrencias por regla, aunque haya más pendientes'
));

-- Deshacer una ocurrencia (softDelete) y volver a correr: el índice único
-- omite `deleted_at IS NULL` a propósito, así que la fecha deshecha queda
-- ocupada y ninguna corrida futura la recrea.
UPDATE public.transactions
SET deleted_at = now()
WHERE recurring_id = tests.get('rm_weekly_id')
  AND (occurred_at AT TIME ZONE 'UTC')::date = (SELECT min((occurred_at AT TIME ZONE 'UTC')::date) FROM public.transactions WHERE recurring_id = tests.get('rm_weekly_id'));

DO $$
DECLARE
  v_deleted_date date;
BEGIN
  SELECT (occurred_at AT TIME ZONE 'UTC')::date INTO v_deleted_date
  FROM public.transactions WHERE recurring_id = tests.get('rm_weekly_id') AND deleted_at IS NOT NULL;
  PERFORM set_config('tests.rm_deleted_date', v_deleted_date::text, false);
END;
$$;

SELECT public.materialize_recurring_transactions();
SELECT public.materialize_recurring_transactions();

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.transactions WHERE recurring_id = tests.get('rm_weekly_id') AND deleted_at IS NULL AND (occurred_at AT TIME ZONE 'UTC')::date = current_setting('tests.rm_deleted_date')::date),
  0,
  'una ocurrencia deshecha (soft-delete) no se recrea en corridas posteriores'
));

-- Un duplicado manual sobre la misma (recurring_id, fecha) choca con el
-- índice único — la garantía en la que se apoya el manejo de 23505 del
-- outbox (sync-worker.ts) cuando cliente y cron corren offline a la vez.
-- Usa la última fecha ya materializada (MAX), que existe con certeza.
SELECT tests.log(throws_ok(
  format(
    $$INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, fx_rate, fx_source, amount_base, source, status, visibility, recurring_id)
      VALUES (gen_random_uuid(), %L, %L, 'expense', %L, %L, 10000, 'ARS', 1, 'identity', 10000, 'recurring', 'cleared', 'household', %L)$$,
    tests.get('rm_household_id'), tests.get('rm_profile_id'),
    (SELECT (max((occurred_at AT TIME ZONE 'UTC')::date)::text || ' 12:00:00+00')::timestamptz FROM public.transactions WHERE recurring_id = tests.get('rm_weekly_id')),
    tests.get('rm_account_id'), tests.get('rm_weekly_id')
  ),
  'duplicate key value violates unique constraint "transactions_recurring_occurrence_uniq"',
  'un insert manual duplicado sobre (recurring_id, fecha) levanta 23505'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
