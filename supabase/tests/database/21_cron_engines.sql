-- F6 — funciones que los cron jobs invocan (20260801160000_cron_engines.sql).
-- No prueba el disparo de pg_cron en sí (eso es "confiar en pg_cron", no
-- código de esta app) sino que cada función hace lo que dice, corrida a mano.
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(8));

SELECT tests.clear_authentication();
SELECT tests.setup_household('ce', 'cron-household-a');

-- Fixture compartida: una cuenta y una categoría de gasto para household A.
SELECT tests.stash('ce_account_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, opening_balance, created_by)
VALUES (tests.get('ce_account_id'), tests.get('ce_household_id'), tests.get('ce_profile_id'), 'Efectivo', 'cash', 'ARS', 0, tests.get('ce_profile_id'));

SELECT tests.stash('ce_category_id', gen_random_uuid());
INSERT INTO public.categories (id, household_id, name, kind, created_by)
VALUES (tests.get('ce_category_id'), tests.get('ce_household_id'), 'Supermercado', 'expense', tests.get('ce_profile_id'));

-- clamped_date: cae al último día real cuando el mes no llega (31 de
-- febrero no existe) y respeta el día pedido cuando sí entra.
SELECT tests.log(is(
  public.clamped_date(2026, 2, 31), '2026-02-28'::date,
  'clamped_date cae al último día real del mes cuando el día pedido no existe'
));
SELECT tests.log(is(
  public.clamped_date(2026, 3, 15), '2026-03-15'::date,
  'clamped_date respeta el día pedido cuando sí entra en el mes'
));

-- E9a — materializador: crea el movimiento de una regla cuyo día es hoy...
SELECT tests.stash('ce_rule_today_id', gen_random_uuid());
INSERT INTO public.recurring_rules (id, household_id, name, kind, category_id, account_id, expected_amount, currency_code, day_of_month, created_by)
VALUES (tests.get('ce_rule_today_id'), tests.get('ce_household_id'), 'Alquiler', 'expense', tests.get('ce_category_id'), tests.get('ce_account_id'), 500000, 'ARS', extract(day FROM current_date)::int, tests.get('ce_profile_id'));

-- ...y NO el de una regla cuyo día no es hoy (a menos que hoy sea el
-- último día del mes Y la regla pida un día más allá — caso poco probable
-- en la corrida real del test, así que se fuerza un día que hoy no es.
SELECT tests.stash('ce_rule_other_day_id', gen_random_uuid());
INSERT INTO public.recurring_rules (id, household_id, name, kind, category_id, account_id, expected_amount, currency_code, day_of_month, created_by)
VALUES (
  tests.get('ce_rule_other_day_id'), tests.get('ce_household_id'), 'Gimnasio', 'expense', tests.get('ce_category_id'), tests.get('ce_account_id'), 90000, 'ARS',
  (CASE WHEN extract(day FROM current_date)::int = 1 THEN 2 ELSE 1 END), tests.get('ce_profile_id')
);

SELECT public.materialize_recurring_transactions();

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.transactions WHERE recurring_id = tests.get('ce_rule_today_id') AND source = 'recurring'),
  1,
  'materialize_recurring_transactions crea el movimiento de la regla cuyo día es hoy'
));
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.transactions WHERE recurring_id = tests.get('ce_rule_other_day_id')),
  0,
  'materialize_recurring_transactions NO crea el de una regla cuyo día no es hoy'
));

-- Mismo día de la cuenta (ARS) que la base del household (ARS) — identity,
-- nunca 'pending' ni un rate inventado.
SELECT tests.log(is(
  (SELECT fx_source FROM public.transactions WHERE recurring_id = tests.get('ce_rule_today_id')),
  'identity',
  'la moneda de la regla coincide con la base del household — fx_source identity, no pending'
));

-- Corrida dos veces el mismo día: no duplica (idempotente).
SELECT public.materialize_recurring_transactions();
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.transactions WHERE recurring_id = tests.get('ce_rule_today_id')),
  1,
  'materialize_recurring_transactions es idempotente — correrla dos veces no duplica'
));

-- E9c — card_statements: closed + vencido + no saldado → overdue.
SELECT tests.stash('ce_statement_id', gen_random_uuid());
INSERT INTO public.card_statements (id, account_id, period_start, period_end, closing_date, due_date, statement_balance, currency_code, paid_amount, status)
VALUES (tests.get('ce_statement_id'), tests.get('ce_account_id'), current_date - 40, current_date - 10, current_date - 10, current_date - 1, 100000, 'ARS', 0, 'closed');

SELECT public.close_overdue_card_statements();
SELECT tests.log(is(
  (SELECT status FROM public.card_statements WHERE id = tests.get('ce_statement_id')),
  'overdue',
  'close_overdue_card_statements pasa a overdue un resumen closed vencido y no saldado'
));

-- E9f — push_subscriptions: tope de 5 por perfil, se queda con las más nuevas.
SELECT tests.clear_authentication();
DO $$
DECLARE
  i int;
BEGIN
  FOR i IN 1..7 LOOP
    INSERT INTO public.push_subscriptions (id, profile_id, endpoint, p256dh, auth_key, created_at)
    VALUES (gen_random_uuid(), tests.get('ce_profile_id'), 'https://example.test/ep-' || i, 'p256dh-' || i, 'auth-' || i, now() - (7 - i || ' hours')::interval);
  END LOOP;
END;
$$;
SELECT public.prune_push_subscriptions();
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.push_subscriptions WHERE profile_id = tests.get('ce_profile_id')),
  5,
  'prune_push_subscriptions deja como máximo 5 suscripciones por perfil'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
