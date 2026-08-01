-- GATE-1: transactions (Patrón A) + transaction_splits (Patrón B, CON-24:
-- sin DELETE) contra un household ajeno, más el invariante needs_fx
-- (fx_rate/amount_base nunca se cae a rate=1).
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(8));

SELECT tests.clear_authentication();
SELECT tests.setup_household('a', 'tx-household-a');
SELECT tests.setup_household('b', 'tx-household-b');

SELECT tests.stash('b_account_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, created_by)
VALUES (tests.get('b_account_id'), tests.get('b_household_id'), tests.get('b_profile_id'), 'Cuenta de B', 'checking', 'ARS', tests.get('b_profile_id'));

SELECT tests.stash('a_account_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, created_by)
VALUES (tests.get('a_account_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'Cuenta de A', 'checking', 'ARS', tests.get('a_profile_id'));

-- Gasto de B sin cotización todavía (needs_fx: fx_rate/amount_base en NULL,
-- fx_source = 'pending', NUNCA rate = 1).
SELECT tests.stash('b_tx_id', gen_random_uuid());
INSERT INTO public.transactions (
  id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, fx_source
)
VALUES (
  tests.get('b_tx_id'), tests.get('b_household_id'), tests.get('b_profile_id'), 'expense', now(),
  tests.get('b_account_id'), 500000, 'ARS', 'pending'
);

SELECT tests.authenticate_as(tests.get('a_profile_id'));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.transactions WHERE household_id = tests.get('b_household_id')),
  0,
  'A no puede leer transacciones de B'
));

SELECT tests.log(throws_ok(
  format(
    $$INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code)
      VALUES (gen_random_uuid(), %L, %L, 'expense', now(), %L, 100, 'ARS')$$,
    tests.get('b_household_id'), tests.get('a_profile_id'), tests.get('b_account_id')
  ),
  'new row violates row-level security policy for table "transactions"',
  'A no puede insertar una transacción en el household de B'
));

-- needs_fx: la transacción pending de B sigue con fx_rate/amount_base en
-- NULL, nunca 1 — se verifica bypasseando RLS (fixture), no como A.
SELECT tests.clear_authentication();
SELECT tests.log(is(
  (SELECT fx_rate FROM public.transactions WHERE id = tests.get('b_tx_id')),
  NULL,
  'la transacción pending de B sigue con fx_rate NULL, nunca 1'
));
SELECT tests.log(is(
  (SELECT amount_base FROM public.transactions WHERE id = tests.get('b_tx_id')),
  NULL,
  'amount_base también en NULL — needs_fx no se resuelve solo'
));

-- transaction_splits: hija de una transacción de A, CON-24 dice que no
-- expone DELETE. La crea el fixture y prueba que A (dueño legítimo) puede
-- leerla/actualizarla pero nunca borrarla.
SELECT tests.stash('a_tx_id', gen_random_uuid());
INSERT INTO public.transactions (
  id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code
)
VALUES (tests.get('a_tx_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'expense', now(), tests.get('a_account_id'), 300000, 'ARS');

SELECT tests.stash('a_split_id', gen_random_uuid());
INSERT INTO public.transaction_splits (id, transaction_id, category_id, amount)
VALUES (tests.get('a_split_id'), tests.get('a_tx_id'), NULL, 150000);

SELECT tests.authenticate_as(tests.get('a_profile_id'));

DELETE FROM public.transaction_splits WHERE id = tests.get('a_split_id');

SELECT tests.clear_authentication();
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.transaction_splits WHERE id = tests.get('a_split_id')),
  1,
  'DELETE real sobre transaction_splits no tuvo efecto: no hay policy de DELETE (CON-24)'
));

-- soft-delete correcto: setear deleted_at sí funciona
SELECT tests.authenticate_as(tests.get('a_profile_id'));
UPDATE public.transaction_splits SET deleted_at = now() WHERE id = tests.get('a_split_id');
SELECT tests.clear_authentication();
SELECT tests.log(isnt(
  (SELECT deleted_at FROM public.transaction_splits WHERE id = tests.get('a_split_id')),
  NULL,
  'el soft-delete (UPDATE deleted_at) sí funciona sobre transaction_splits'
));

-- intento de A de reasignar el split a una transacción de B: transaction_id
-- es inmutable. Un WITH CHECK que falla en UPDATE lanza excepción dura, no
-- un no-op silencioso — verificado empíricamente contra el proyecto real.
SELECT tests.authenticate_as(tests.get('a_profile_id'));
SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.transaction_splits SET transaction_id = %L WHERE id = %L$$,
    tests.get('b_tx_id'), tests.get('a_split_id')
  ),
  'new row violates row-level security policy for table "transaction_splits"',
  'A no puede reasignar el split a una transacción de B (transaction_id inmutable)'
));
SELECT tests.clear_authentication();
SELECT tests.log(is(
  (SELECT transaction_id FROM public.transaction_splits WHERE id = tests.get('a_split_id')),
  tests.get('a_tx_id'),
  'el split sigue apuntando a la transacción original de A'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
