-- GATE-1: purge_household_step / is_household_owner (20260804000000).
-- Un no-owner no puede ejecutar el borrado; el owner sí, y solo se llevan
-- puestos los datos del household indicado — el household de control (A)
-- sobrevive intacto.
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(6));

SELECT tests.clear_authentication();
SELECT tests.setup_household('a', 'purge-household-a');
SELECT tests.setup_household('b', 'purge-household-b');

-- Segundo miembro de B, no-owner — para probar que un member no puede
-- ejecutar el borrado aunque pertenezca al household.
SELECT tests.setup_user('bm', 'purge-member-b');
INSERT INTO public.household_members (household_id, profile_id, role, status, joined_at)
VALUES (tests.get('b_household_id'), tests.get('bm_profile_id'), 'member', 'active', now());

-- Datos de A (control) y de B (a borrar), simétricos: una cuenta, una
-- categoría, una transacción y un tag cada uno.
SELECT tests.stash('a_account_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, created_by)
VALUES (tests.get('a_account_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'Cuenta de A', 'checking', 'ARS', tests.get('a_profile_id'));

SELECT tests.stash('a_category_id', gen_random_uuid());
INSERT INTO public.categories (id, household_id, name, kind, created_by)
VALUES (tests.get('a_category_id'), tests.get('a_household_id'), 'Categoría de A', 'expense', tests.get('a_profile_id'));

SELECT tests.stash('a_tx_id', gen_random_uuid());
INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, category_id)
VALUES (tests.get('a_tx_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'expense', now(), tests.get('a_account_id'), 1000, 'ARS', tests.get('a_category_id'));

SELECT tests.stash('a_tag_id', gen_random_uuid());
INSERT INTO public.tags (id, household_id, name)
VALUES (tests.get('a_tag_id'), tests.get('a_household_id'), 'Tag de A');

SELECT tests.stash('b_account_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, created_by)
VALUES (tests.get('b_account_id'), tests.get('b_household_id'), tests.get('b_profile_id'), 'Cuenta de B', 'checking', 'ARS', tests.get('b_profile_id'));

SELECT tests.stash('b_category_id', gen_random_uuid());
INSERT INTO public.categories (id, household_id, name, kind, created_by)
VALUES (tests.get('b_category_id'), tests.get('b_household_id'), 'Categoría de B', 'expense', tests.get('b_profile_id'));

SELECT tests.stash('b_tx_id', gen_random_uuid());
INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, category_id)
VALUES (tests.get('b_tx_id'), tests.get('b_household_id'), tests.get('b_profile_id'), 'expense', now(), tests.get('b_account_id'), 2000, 'ARS', tests.get('b_category_id'));

SELECT tests.stash('b_tag_id', gen_random_uuid());
INSERT INTO public.tags (id, household_id, name)
VALUES (tests.get('b_tag_id'), tests.get('b_household_id'), 'Tag de B');

-- Un member de B (no-owner) no puede ejecutar el borrado, ni el propio ni el de A.
SELECT tests.authenticate_as(tests.get('bm_profile_id'));
SELECT tests.log(throws_ok(
  format($$SELECT public.purge_household_step(%L, 'transactions')$$, tests.get('b_household_id')),
  'Solo el owner del household puede borrar sus datos',
  'Un member (no-owner) de B no puede purgar el household de B'
));

-- El owner de A no puede purgar el household de B (no pertenece).
SELECT tests.authenticate_as(tests.get('a_profile_id'));
SELECT tests.log(throws_ok(
  format($$SELECT public.purge_household_step(%L, 'transactions')$$, tests.get('b_household_id')),
  'Solo el owner del household puede borrar sus datos',
  'El owner de A no puede purgar el household de B'
));

-- El owner de B corre los 7 pasos sobre su propio household.
SELECT tests.authenticate_as(tests.get('b_profile_id'));
SELECT public.purge_household_step(tests.get('b_household_id'), 'transactions');
SELECT public.purge_household_step(tests.get('b_household_id'), 'investments');
SELECT public.purge_household_step(tests.get('b_household_id'), 'recurring_debts');
SELECT public.purge_household_step(tests.get('b_household_id'), 'budgets_goals');
SELECT public.purge_household_step(tests.get('b_household_id'), 'accounts');
SELECT public.purge_household_step(tests.get('b_household_id'), 'categories_rules');
SELECT public.purge_household_step(tests.get('b_household_id'), 'fx_prefs');

SELECT tests.clear_authentication();

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.transactions WHERE household_id = tests.get('b_household_id')),
  0,
  'Las transacciones de B fueron borradas'
));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.accounts WHERE household_id = tests.get('b_household_id')),
  0,
  'Las cuentas de B fueron borradas'
));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.categories WHERE household_id = tests.get('b_household_id'))
    + (SELECT count(*)::int FROM public.tags WHERE household_id = tests.get('b_household_id')),
  0,
  'Las categorías y tags de B fueron borrados'
));

-- El household de A (control) sigue intacto — el borrado de B no se filtró.
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.transactions WHERE id = tests.get('a_tx_id'))
    + (SELECT count(*)::int FROM public.accounts WHERE id = tests.get('a_account_id'))
    + (SELECT count(*)::int FROM public.categories WHERE id = tests.get('a_category_id'))
    + (SELECT count(*)::int FROM public.tags WHERE id = tests.get('a_tag_id')),
  4,
  'Los datos de A sobreviven intactos después de purgar B'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
