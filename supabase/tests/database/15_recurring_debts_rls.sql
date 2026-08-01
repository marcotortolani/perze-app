-- GATE-1: recurring_rules, debts (+ debt_schedule hija). Cross-household
-- isolation + soft-delete (post fix 20260801020000).
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(8));

SELECT tests.clear_authentication();
SELECT tests.setup_household('a', 'rd-household-a');
SELECT tests.setup_household('b', 'rd-household-b');

-- v2 (A2, auditoría técnica): recurring_rules ya no tiene template/rrule —
-- necesita account_id (NOT NULL) y expected_amount/currency_code/day_of_month.
SELECT tests.stash('b_account_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, created_by)
VALUES (tests.get('b_account_id'), tests.get('b_household_id'), tests.get('b_profile_id'), 'Cuenta de B', 'checking', 'ARS', tests.get('b_profile_id'));

SELECT tests.stash('a_account_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, created_by)
VALUES (tests.get('a_account_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'Cuenta de A', 'checking', 'ARS', tests.get('a_profile_id'));

SELECT tests.stash('b_rule_id', gen_random_uuid());
INSERT INTO public.recurring_rules (id, household_id, name, kind, account_id, expected_amount, currency_code, day_of_month, created_by)
VALUES (tests.get('b_rule_id'), tests.get('b_household_id'), 'Netflix de B', 'expense', tests.get('b_account_id'), 500000, 'ARS', 5, tests.get('b_profile_id'));

SELECT tests.stash('a_rule_id', gen_random_uuid());
INSERT INTO public.recurring_rules (id, household_id, name, kind, account_id, expected_amount, currency_code, day_of_month, created_by)
VALUES (tests.get('a_rule_id'), tests.get('a_household_id'), 'Netflix de A', 'expense', tests.get('a_account_id'), 500000, 'ARS', 5, tests.get('a_profile_id'));

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
  -- A5: protección real vía trigger recurring_rules_immutable, no el WITH CHECK (tautológico).
  'La columna household_id es inmutable en recurring_rules',
  'A no puede mover su regla recurrente al household de B'
));

-- v2: recurring_rules usa archived_at, no deleted_at.
UPDATE public.recurring_rules SET archived_at = now() WHERE id = tests.get('a_rule_id');
SELECT tests.log(isnt(
  (SELECT archived_at FROM public.recurring_rules WHERE id = tests.get('a_rule_id')),
  NULL,
  'A puede archivar su propia regla recurrente'
));

SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.debts SET household_id = %L WHERE id = %L$$,
    tests.get('b_household_id'), tests.get('a_debt_id')
  ),
  -- A5: protección real vía trigger debts_immutable, no el WITH CHECK (tautológico).
  'La columna household_id es inmutable en debts',
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
