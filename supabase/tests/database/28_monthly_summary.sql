-- Lado de lectura del resumen por mail: `summary_transactions()` y
-- `summary_account_balances()` (`20260810090000_monthly_summary_read.sql`).
--
-- Dos cosas se prueban acá y en ningún otro lado:
--
-- 1. **Que el mail no filtre lo que la app oculta.** Las dos funciones
--    toman un `p_viewer` arbitrario y corren con `service_role`, así que
--    RLS no las protege: el filtro de visibilidad es código, y si se
--    afloja nadie se entera hasta que a alguien le llega por correo el
--    gasto privado de otro.
-- 2. **Que los saldos den lo mismo que `computeTransactionEffects()`.** La
--    agregación de saldos es la única regla de dinero duplicada en SQL
--    (el resto vive en TypeScript, ver la nota de la migración). Los
--    números esperados de este archivo están calculados a mano con las
--    reglas de ese módulo: expense y la pata origen de transfer restan,
--    income/adjustment/investing suman con el signo de `amount`, la pata
--    destino de transfer suma `counter_amount`.
--
-- Escenario: household A con dos miembros (a, dueño; b, miembro). Período
-- [2026-07-01, 2026-08-01) en UTC.
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(14));

SELECT tests.clear_authentication();
SELECT tests.setup_household('a', 'ms-household-a');
SELECT tests.setup_household('b', 'ms-household-b'); -- su propio hogar; abajo se suma al de A
SELECT tests.setup_household('c', 'ms-household-c'); -- ajeno, nunca miembro de A

INSERT INTO public.household_members (household_id, profile_id, role, status, joined_at)
VALUES (tests.get('a_household_id'), tests.get('b_profile_id'), 'member', 'active', now());

-- Cuentas -------------------------------------------------------------
SELECT tests.stash('acc1_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, opening_balance, created_by)
VALUES (tests.get('acc1_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'Efectivo', 'cash', 'ARS', 100000, tests.get('a_profile_id'));

SELECT tests.stash('acc2_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, opening_balance, created_by)
VALUES (tests.get('acc2_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'Banco', 'checking', 'ARS', 500000, tests.get('a_profile_id'));

-- Privada de B: A no la ve, ni la cuenta ni sus movimientos.
SELECT tests.stash('accp_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, opening_balance, visibility, created_by)
VALUES (tests.get('accp_id'), tests.get('a_household_id'), tests.get('b_profile_id'), 'Privada', 'cash', 'ARS', 900000, 'private', tests.get('b_profile_id'));

-- Abierta DESPUÉS del período: antes de `opening_date` la cuenta no
-- existía, así que su saldo es 0 y no `opening_balance`.
SELECT tests.stash('accf_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, opening_balance, opening_date, created_by)
VALUES (tests.get('accf_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'Nueva', 'cash', 'ARS', 700000, '2026-09-01', tests.get('a_profile_id'));

-- Categorías -----------------------------------------------------------
SELECT tests.stash('cat_super_id', gen_random_uuid());
INSERT INTO public.categories (id, household_id, name, kind, created_by)
VALUES (tests.get('cat_super_id'), tests.get('a_household_id'), 'Supermercado', 'expense', tests.get('a_profile_id'));

SELECT tests.stash('cat_priv_id', gen_random_uuid());
INSERT INTO public.categories (id, household_id, name, kind, visibility, owner_id, created_by)
VALUES (tests.get('cat_priv_id'), tests.get('a_household_id'), 'Terapia', 'expense', 'private', tests.get('b_profile_id'), tests.get('b_profile_id'));

-- Movimientos ----------------------------------------------------------
-- Anterior al período: mueve el saldo de apertura, no entra en las filas.
INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, fx_rate, fx_source, amount_base)
VALUES (gen_random_uuid(), tests.get('a_household_id'), tests.get('a_profile_id'), 'expense', '2026-06-15T12:00:00Z', tests.get('acc1_id'), 10000, 'ARS', 1, 'identity', 10000);

INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, category_id, fx_rate, fx_source, amount_base)
VALUES (gen_random_uuid(), tests.get('a_household_id'), tests.get('a_profile_id'), 'expense', '2026-07-05T12:00:00Z', tests.get('acc1_id'), 30000, 'ARS', tests.get('cat_super_id'), 1, 'identity', 30000);

INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, fx_rate, fx_source, amount_base)
VALUES (gen_random_uuid(), tests.get('a_household_id'), tests.get('a_profile_id'), 'income', '2026-07-06T12:00:00Z', tests.get('acc2_id'), 80000, 'ARS', 1, 'identity', 80000);

INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, counter_account_id, amount, counter_amount, currency_code, fx_rate, fx_source, amount_base)
VALUES (gen_random_uuid(), tests.get('a_household_id'), tests.get('a_profile_id'), 'transfer', '2026-07-07T12:00:00Z', tests.get('acc1_id'), tests.get('acc2_id'), 20000, 20000, 'ARS', 1, 'identity', 20000);

-- Sin cotización: `amount_base` NULL viaja como NULL y el cálculo lo
-- excluye. Mueve el saldo igual — `amount` está en la moneda de la cuenta.
INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, fx_source)
VALUES (gen_random_uuid(), tests.get('a_household_id'), tests.get('a_profile_id'), 'expense', '2026-07-08T12:00:00Z', tests.get('acc1_id'), 5000, 'ARS', 'pending');

-- Compra de instrumentos: el signo ya viaja en `amount`.
INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, fx_rate, fx_source, amount_base)
VALUES (gen_random_uuid(), tests.get('a_household_id'), tests.get('a_profile_id'), 'investing', '2026-07-09T12:00:00Z', tests.get('acc2_id'), -40000, 'ARS', 1, 'identity', -40000);

-- Privado de B en una cuenta compartida: B lo ve, A no.
INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, visibility, fx_rate, fx_source, amount_base)
VALUES (gen_random_uuid(), tests.get('a_household_id'), tests.get('b_profile_id'), 'expense', '2026-07-10T12:00:00Z', tests.get('acc2_id'), 7000, 'ARS', 'private', 1, 'identity', 7000);

-- Household, pero categorizado con una categoría privada de B: A ve la
-- fila y su monto, no el nombre de la categoría.
INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, category_id, fx_rate, fx_source, amount_base)
VALUES (gen_random_uuid(), tests.get('a_household_id'), tests.get('b_profile_id'), 'expense', '2026-07-11T12:00:00Z', tests.get('acc2_id'), 9000, 'ARS', tests.get('cat_priv_id'), 1, 'identity', 9000);

-- Movimiento en la cuenta privada de B, invisible para A.
INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, fx_rate, fx_source, amount_base)
VALUES (gen_random_uuid(), tests.get('a_household_id'), tests.get('b_profile_id'), 'expense', '2026-07-12T12:00:00Z', tests.get('accp_id'), 50000, 'ARS', 1, 'identity', 50000);

-- Movimientos -----------------------------------------------------------
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.summary_transactions(tests.get('a_household_id'), tests.get('a_profile_id'), '2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z')),
  6,
  'A ve sus 6 movimientos del período: ni el privado de B, ni el de la cuenta privada, ni el de junio'
));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.summary_transactions(tests.get('a_household_id'), tests.get('b_profile_id'), '2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z')),
  8,
  'B ve los mismos 6 más su privado y el de su cuenta privada'
));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.summary_transactions(tests.get('a_household_id'), tests.get('a_profile_id'), '2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z') WHERE amount_base IS NULL),
  1,
  'el movimiento sin cotización viaja con amount_base NULL, no con un 1 inventado'
));

SELECT tests.log(is(
  (SELECT category_name FROM public.summary_transactions(tests.get('a_household_id'), tests.get('a_profile_id'), '2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z') WHERE amount_base = '30000'),
  'Supermercado',
  'una categoría del hogar viaja con su nombre'
));

SELECT tests.log(is(
  (SELECT category_name FROM public.summary_transactions(tests.get('a_household_id'), tests.get('a_profile_id'), '2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z') WHERE amount_base = '9000'),
  NULL,
  'la categoría privada de B no se nombra en el resumen de A, aunque el movimiento sí cuente'
));

SELECT tests.log(is(
  (SELECT category_name FROM public.summary_transactions(tests.get('a_household_id'), tests.get('b_profile_id'), '2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z') WHERE amount_base = '9000'),
  'Terapia',
  'para B, que es su dueña, la misma categoría sí viaja con nombre'
));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.summary_transactions(tests.get('a_household_id'), tests.get('c_profile_id'), '2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z')),
  0,
  'quien no es miembro activo del hogar no lee una sola fila'
));

-- Saldos ---------------------------------------------------------------
-- acc1: 100000 - 10000 (junio) = 90000 de apertura;
--       90000 - 30000 - 20000 (pata origen de la transferencia) - 5000 = 35000 al cierre.
SELECT tests.log(is(
  (SELECT opening FROM public.summary_account_balances(tests.get('a_household_id'), tests.get('a_profile_id'), '2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z') WHERE name = 'Efectivo'),
  '90000',
  'la apertura descuenta lo anterior al período, no arranca en opening_balance'
));

SELECT tests.log(is(
  (SELECT closing FROM public.summary_account_balances(tests.get('a_household_id'), tests.get('a_profile_id'), '2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z') WHERE name = 'Efectivo'),
  '35000',
  'el cierre incluye el gasto sin cotización: mueve el saldo aunque no entre en los totales'
));

-- acc2 para A: 500000 + 80000 + 20000 (pata destino) - 40000 (investing) - 9000 = 551000.
SELECT tests.log(is(
  (SELECT closing FROM public.summary_account_balances(tests.get('a_household_id'), tests.get('a_profile_id'), '2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z') WHERE name = 'Banco'),
  '551000',
  'transferencia, ingreso e inversión mueven el saldo con el mismo signo que computeTransactionEffects'
));

-- Para B son 551000 - 7000 (su gasto privado, que A no ve).
SELECT tests.log(is(
  (SELECT closing FROM public.summary_account_balances(tests.get('a_household_id'), tests.get('b_profile_id'), '2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z') WHERE name = 'Banco'),
  '544000',
  'el saldo que ve cada miembro es el de SUS movimientos visibles — el mail dice lo mismo que la pantalla'
));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.summary_account_balances(tests.get('a_household_id'), tests.get('a_profile_id'), '2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z') WHERE name = 'Privada'),
  0,
  'la cuenta privada de B no aparece en el resumen de A'
));

SELECT tests.log(is(
  (SELECT opening FROM public.summary_account_balances(tests.get('a_household_id'), tests.get('a_profile_id'), '2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z') WHERE name = 'Nueva'),
  '0',
  'una cuenta abierta después del período vale 0, no su opening_balance'
));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.summary_account_balances(tests.get('a_household_id'), tests.get('c_profile_id'), '2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z')),
  0,
  'un no-miembro tampoco lee saldos'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
