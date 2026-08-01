-- GATE-1: recurring_rules, debts (+ debt_schedule hija). Cross-household
-- isolation + soft-delete (post fix 20260801020000).
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(8));

SELECT tests.clear_authentication();
SELECT tests.setup_household('a', 'rd-household-a');
SELECT tests.setup_household('b', 'rd-household-b');

SELECT tests.stash('b_rule_id', gen_random_uuid());
INSERT INTO public.recurring_rules (id, household_id, name, template, rrule, created_by)
VALUES (tests.get('b_rule_id'), tests.get('b_household_id'), 'Netflix de B', '{}'::jsonb, 'FREQ=MONTHLY', tests.get('b_profile_id'));

SELECT tests.stash('a_rule_id', gen_random_uuid());
INSERT INTO public.recurring_rules (id, household_id, name, template, rrule, created_by)
VALUES (tests.get('a_rule_id'), tests.get('a_household_id'), 'Netflix de A', '{}'::jsonb, 'FREQ=MONTHLY', tests.get('a_profile_id'));

SELECT tests.stash('a_debt_id', gen_random_uuid());
INSERT INTO public.debts (id, household_id, kind, name, principal, currency_code, start_date, direction, created_by)
VALUES (tests.get('a_debt_id'), tests.get('a_household_id'), 'personal', 'Deuda de A', 1000000, 'ARS', current_date, 'owe', tests.get('a_profile_id'));

SELECT tests.stash('a_debt_schedule_id', gen_random_uuid());
INSERT INTO public.debt_schedule (id, debt_id, due_date, number, principal_amount)
VALUES (tests.get('a_debt_schedule_id'), tests.get('a_debt_id'), current_date + 30, 1, 100000);

SELECT tests.authenticate_as(tests.get('a_profile_id'));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.recurring_rules WHERE household_id = tests.get('b_household_id')),
  0,
  'A no puede leer reglas recurrentes de B'
));

SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.recurring_rules SET household_id = %L WHERE id = %L$$,
    tests.get('b_household_id'), tests.get('a_rule_id')
  ),
  'new row violates row-level security policy for table "recurring_rules"',
  'A no puede mover su regla recurrente al household de B'
));

UPDATE public.recurring_rules SET deleted_at = now() WHERE id = tests.get('a_rule_id');
SELECT tests.log(isnt(
  (SELECT deleted_at FROM public.recurring_rules WHERE id = tests.get('a_rule_id')),
  NULL,
  'A puede soft-deletear su propia regla recurrente'
));

SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.debts SET household_id = %L WHERE id = %L$$,
    tests.get('b_household_id'), tests.get('a_debt_id')
  ),
  'new row violates row-level security policy for table "debts"',
  'A no puede mover su deuda al household de B'
));

UPDATE public.debts SET deleted_at = now() WHERE id = tests.get('a_debt_id');
SELECT tests.log(isnt(
  (SELECT deleted_at FROM public.debts WHERE id = tests.get('a_debt_id')),
  NULL,
  'A puede soft-deletear su propia deuda'
));

-- debt_schedule (Patrón B): sigue siendo legible/editable por A pese al
-- soft-delete del padre (el filtro deleted_at ya no está en RLS)
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.debt_schedule WHERE id = tests.get('a_debt_schedule_id')),
  1,
  'A puede leer el debt_schedule de su propia deuda'
));

SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.debt_schedule SET debt_id = gen_random_uuid() WHERE id = %L$$,
    tests.get('a_debt_schedule_id')
  ),
  'new row violates row-level security policy for table "debt_schedule"',
  'A no puede reasignar el debt_schedule a otra deuda inexistente/ajena (debt_id inmutable)'
));

SELECT tests.clear_authentication();
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.debt_schedule WHERE debt_id = tests.get('a_debt_id')),
  1,
  'el debt_schedule de A sigue intacto después de los intentos fallidos'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
