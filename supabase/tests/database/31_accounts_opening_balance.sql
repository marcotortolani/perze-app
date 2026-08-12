-- Bug reportado: una cuenta con saldo inicial se muestra en 0 hasta el
-- primer movimiento, y conciliarla después duplica el saldo. Causa: nunca
-- hubo un trigger que corriera `recompute_account_balance` al insertar la
-- cuenta — ver `20260811090000_accounts_recompute_on_insert.sql`.
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(6));

SELECT tests.clear_authentication();
SELECT tests.setup_household('a', 'ob-household-a'); -- base_currency ARS (default)
SELECT tests.authenticate_as(tests.get('a_profile_id'));

-- Alta con saldo inicial: current_balance tiene que salir igual al
-- opening_balance sin necesidad de ningún movimiento.
SELECT tests.stash('acc_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, opening_balance, created_by)
VALUES (tests.get('acc_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'Ahorros', 'savings', 'ARS', 100000, tests.get('a_profile_id'));

SELECT tests.log(is(
  (SELECT current_balance FROM public.accounts WHERE id = tests.get('acc_id')),
  100000::bigint,
  'una cuenta recién creada con saldo inicial arranca con ese saldo, sin necesidad de un movimiento'
));

-- Un gasto posterior resta sobre ese piso, no sobre 0.
SELECT tests.stash('cat_id', gen_random_uuid());
INSERT INTO public.categories (id, household_id, name, kind, is_system, created_by)
VALUES (tests.get('cat_id'), tests.get('a_household_id'), 'Varios', 'expense', false, tests.get('a_profile_id'));

INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, category_id, fx_rate, fx_source, amount_base)
VALUES (gen_random_uuid(), tests.get('a_household_id'), tests.get('a_profile_id'), 'expense', now(), tests.get('acc_id'), 30000, 'ARS', tests.get('cat_id'), 1, 'identity', 30000);

SELECT tests.log(is(
  (SELECT current_balance FROM public.accounts WHERE id = tests.get('acc_id')),
  70000::bigint,
  'el gasto resta sobre opening_balance + delta, no sobre 0'
));

-- Conciliar contra el saldo real (mismo número que ya tiene la cuenta) no
-- debería generar diferencia — este es el caso que antes duplicaba: la
-- app calculaba `diff` contra un current_balance que en el servidor
-- todavía era 0.
SELECT tests.log(is(
  (SELECT current_balance FROM public.accounts WHERE id = tests.get('acc_id')) - 70000::bigint,
  0::bigint,
  'conciliar contra el saldo que la propia cuenta ya refleja da diferencia 0 (no hay ajuste fantasma que crear)'
));

-- UPDATE de opening_balance recalcula (cubre una futura edición del alta).
UPDATE public.accounts SET opening_balance = 200000 WHERE id = tests.get('acc_id');

SELECT tests.log(is(
  (SELECT current_balance FROM public.accounts WHERE id = tests.get('acc_id')),
  170000::bigint,
  'editar opening_balance recalcula current_balance manteniendo el delta de transactions'
));

-- Una segunda cuenta sin saldo inicial explícito sigue arrancando en 0
-- (no hay que inventarle plata a nadie).
SELECT tests.stash('acc2_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, created_by)
VALUES (tests.get('acc2_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'Efectivo', 'cash', 'ARS', tests.get('a_profile_id'));

SELECT tests.log(is(
  (SELECT current_balance FROM public.accounts WHERE id = tests.get('acc2_id')),
  0::bigint,
  'una cuenta sin saldo inicial explícito arranca en 0, como antes'
));

-- El backfill de la migración es idempotente: volver a correr
-- recompute_account_balance sobre una cuenta ya correcta no la mueve.
SELECT public.recompute_account_balance(tests.get('acc_id'));
SELECT tests.log(is(
  (SELECT current_balance FROM public.accounts WHERE id = tests.get('acc_id')),
  170000::bigint,
  'recompute_account_balance es idempotente sobre una cuenta ya correcta'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
