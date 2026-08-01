-- GATE-1: budgets (+ budget_lines hija) y goals. Cross-household isolation
-- + soft-delete (deleted_at IS NULL ya no está en las policies de SELECT
-- desde 20260801020000_fix_soft_delete_rls.sql — se prueba que sigue así).
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(10));

SELECT tests.clear_authentication();
SELECT tests.setup_household('a', 'bg-household-a');
SELECT tests.setup_household('b', 'bg-household-b');

SELECT tests.stash('b_budget_id', gen_random_uuid());
INSERT INTO public.budgets (id, household_id, name, period, start_date, currency_code, created_by)
VALUES (tests.get('b_budget_id'), tests.get('b_household_id'), 'Presupuesto de B', 'monthly', current_date, 'ARS', tests.get('b_profile_id'));

SELECT tests.stash('a_budget_id', gen_random_uuid());
INSERT INTO public.budgets (id, household_id, name, period, start_date, currency_code, created_by)
VALUES (tests.get('a_budget_id'), tests.get('a_household_id'), 'Presupuesto de A', 'monthly', current_date, 'ARS', tests.get('a_profile_id'));

SELECT tests.stash('a_budget_line_id', gen_random_uuid());
INSERT INTO public.budget_lines (id, budget_id, amount)
VALUES (tests.get('a_budget_line_id'), tests.get('a_budget_id'), 100000);

SELECT tests.stash('b_goal_id', gen_random_uuid());
INSERT INTO public.goals (id, household_id, name, target_amount, currency_code, created_by)
VALUES (tests.get('b_goal_id'), tests.get('b_household_id'), 'Meta de B', 500000, 'ARS', tests.get('b_profile_id'));

SELECT tests.authenticate_as(tests.get('a_profile_id'));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.budgets WHERE household_id = tests.get('b_household_id')),
  0,
  'A no puede leer presupuestos de B'
));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.budget_lines WHERE budget_id = tests.get('b_budget_id')),
  0,
  'A no puede leer budget_lines de un presupuesto de B (aunque conozca el id)'
));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.goals WHERE household_id = tests.get('b_household_id')),
  0,
  'A no puede leer metas de B'
));

SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.budgets SET household_id = %L WHERE id = %L$$,
    tests.get('b_household_id'), tests.get('a_budget_id')
  ),
  'new row violates row-level security policy for table "budgets"',
  'A no puede mover su presupuesto al household de B'
));

SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.budget_lines SET budget_id = %L WHERE id = %L$$,
    tests.get('b_budget_id'), tests.get('a_budget_line_id')
  ),
  'new row violates row-level security policy for table "budget_lines"',
  'A no puede reasignar su budget_line al presupuesto de B (budget_id inmutable)'
));

-- soft-delete: A borra su propio presupuesto (UPDATE deleted_at) — tiene
-- que funcionar, es exactamente el bug que corrigió 20260801020000
UPDATE public.budgets SET deleted_at = now() WHERE id = tests.get('a_budget_id');
SELECT tests.log(isnt(
  (SELECT deleted_at FROM public.budgets WHERE id = tests.get('a_budget_id')),
  NULL,
  'A puede soft-deletear su propio presupuesto (deleted_at IS NULL ya no bloquea el UPDATE)'
));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.budgets WHERE id = tests.get('a_budget_id')),
  1,
  'el presupuesto soft-deleteado sigue siendo visible por RLS (deleted_at ya no se filtra ahí — lo filtra la app)'
));

-- goals: mismo patrón de inmutabilidad + soft-delete, sobre un goal propio de A
SELECT tests.stash('a_goal_id', gen_random_uuid());
SELECT tests.clear_authentication();
INSERT INTO public.goals (id, household_id, name, target_amount, currency_code, created_by)
VALUES (tests.get('a_goal_id'), tests.get('a_household_id'), 'Meta de A', 300000, 'ARS', tests.get('a_profile_id'));
SELECT tests.authenticate_as(tests.get('a_profile_id'));

SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.goals SET household_id = %L WHERE id = %L$$,
    tests.get('b_household_id'), tests.get('a_goal_id')
  ),
  'new row violates row-level security policy for table "goals"',
  'A no puede mover su meta al household de B'
));

UPDATE public.goals SET deleted_at = now() WHERE id = tests.get('a_goal_id');
SELECT tests.log(isnt(
  (SELECT deleted_at FROM public.goals WHERE id = tests.get('a_goal_id')),
  NULL,
  'A puede soft-deletear su propia meta'
));

SELECT tests.log(is(
  public.can_write(tests.get('b_household_id')),
  false,
  'A no tiene can_write() sobre el household de B (sanity check final)'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
