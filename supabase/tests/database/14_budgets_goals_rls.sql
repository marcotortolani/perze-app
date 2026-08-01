-- GATE-1: budgets y goals (v2 — ver A2 de la auditoría técnica: ya no hay
-- budget_lines hija, ni deleted_at en estas dos tablas, solo archived_at,
-- así que el patrón de "soft-delete auto-referencia" de
-- 20260801020000_fix_soft_delete_rls.sql no aplica acá — nunca aplicó,
-- de hecho, porque la política de SELECT de v2 nunca filtró por columna
-- propia). Cross-household isolation + inmutabilidad de household_id.
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(8));

SELECT tests.clear_authentication();
SELECT tests.setup_household('a', 'bg-household-a');
SELECT tests.setup_household('b', 'bg-household-b');

SELECT tests.stash('b_budget_id', gen_random_uuid());
INSERT INTO public.budgets (id, household_id, name, amount_limit, currency_code, created_by)
VALUES (tests.get('b_budget_id'), tests.get('b_household_id'), 'Presupuesto de B', 100000, 'ARS', tests.get('b_profile_id'));

SELECT tests.stash('a_budget_id', gen_random_uuid());
INSERT INTO public.budgets (id, household_id, name, amount_limit, currency_code, created_by)
VALUES (tests.get('a_budget_id'), tests.get('a_household_id'), 'Presupuesto de A', 200000, 'ARS', tests.get('a_profile_id'));

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
  (SELECT count(*)::int FROM public.goals WHERE household_id = tests.get('b_household_id')),
  0,
  'A no puede leer metas de B'
));

SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.budgets SET household_id = %L WHERE id = %L$$,
    tests.get('b_household_id'), tests.get('a_budget_id')
  ),
  -- A5: protección real vía trigger budgets_immutable, no el WITH CHECK (tautológico).
  'La columna household_id es inmutable en budgets',
  'A no puede mover su presupuesto al household de B'
));

UPDATE public.budgets SET archived_at = now() WHERE id = tests.get('a_budget_id');
SELECT tests.log(isnt(
  (SELECT archived_at FROM public.budgets WHERE id = tests.get('a_budget_id')),
  NULL,
  'A puede archivar su propio presupuesto'
));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.budgets WHERE id = tests.get('a_budget_id')),
  1,
  'el presupuesto archivado sigue siendo visible por RLS (archived_at no se filtra ahí — lo filtra la app)'
));

-- goals: mismo patrón de inmutabilidad + archivado, sobre un goal propio de A
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
  -- A5: protección real vía trigger goals_immutable, no el WITH CHECK (tautológico).
  'La columna household_id es inmutable en goals',
  'A no puede mover su meta al household de B'
));

UPDATE public.goals SET archived_at = now() WHERE id = tests.get('a_goal_id');
SELECT tests.log(isnt(
  (SELECT archived_at FROM public.goals WHERE id = tests.get('a_goal_id')),
  NULL,
  'A puede archivar su propia meta'
));

SELECT tests.log(is(
  public.can_write(tests.get('b_household_id')),
  false,
  'A no tiene can_write() sobre el household de B (sanity check final)'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
