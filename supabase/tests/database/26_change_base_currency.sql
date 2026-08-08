-- change_household_base_currency() / preflight_change_base_currency() —
-- PR 4 del plan de multi-household. Cubre: identidad exacta cuando la
-- moneda de la transacción YA es la base nueva (incluida una que estaba
-- `pending` — se resuelve gratis, no es un rate inventado), descarte a
-- pending del resto (nunca un rate recalculado), propagación a splits,
-- alcance por household (no toca a B), y el permiso de admin.
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(19));

SELECT tests.clear_authentication();
SELECT tests.setup_household('a', 'refx-household-a'); -- base_currency 'ARS' por default de tests.create_household
SELECT tests.setup_household('b', 'refx-household-b');

SELECT tests.stash('a_account_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, created_by)
VALUES (tests.get('a_account_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'Cuenta ARS', 'checking', 'ARS', tests.get('a_profile_id'));

SELECT tests.stash('a_usd_account_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, created_by)
VALUES (tests.get('a_usd_account_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'Cuenta USD', 'checking', 'USD', tests.get('a_profile_id'));

-- (1) ARS resuelta contra la base vieja (ARS = ARS, identity) — al pasar la
-- base a USD, esta transacción deja de estar en la base y tiene que
-- DESCARTARSE a pending, nunca recalcularse.
SELECT tests.stash('a_ars_tx_id', gen_random_uuid());
INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, fx_rate, fx_source, amount_base)
VALUES (tests.get('a_ars_tx_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'expense', now(), tests.get('a_account_id'), 500000, 'ARS', 1, 'identity', 500000);

-- (2) USD ya resuelta con un rate "inherited" viejo — al pasar la base a
-- USD, se vuelve identidad EXACTA (rate=1), no se conserva el 1.28 viejo.
SELECT tests.stash('a_usd_tx_id', gen_random_uuid());
INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, fx_rate, fx_source, amount_base)
VALUES (tests.get('a_usd_tx_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'expense', now(), tests.get('a_usd_account_id'), 10000, 'USD', 1.28, 'inherited', 12800);

-- (3) USD todavía pending — al pasar la base a USD, esto SÍ se resuelve:
-- currency_code ya es la base nueva, así que es una identidad exacta y
-- gratis, no una invención. Sigue siendo la transición legítima
-- pending → resuelto, solo que la dispara el cambio de base en vez de E8.
SELECT tests.stash('a_usd_pending_tx_id', gen_random_uuid());
INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, fx_source)
VALUES (tests.get('a_usd_pending_tx_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'expense', now(), tests.get('a_usd_account_id'), 5000, 'USD', 'pending');

-- Split de (1): tiene que caer a pending junto con el padre.
SELECT tests.stash('a_split_id', gen_random_uuid());
INSERT INTO public.transaction_splits (id, transaction_id, amount, amount_base, fx_source)
VALUES (tests.get('a_split_id'), tests.get('a_ars_tx_id'), 500000, 500000, 'identity');

-- B: mismo escenario, para probar que el cambio de A no lo toca.
SELECT tests.stash('b_account_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, created_by)
VALUES (tests.get('b_account_id'), tests.get('b_household_id'), tests.get('b_profile_id'), 'Cuenta de B', 'checking', 'ARS', tests.get('b_profile_id'));

SELECT tests.stash('b_tx_id', gen_random_uuid());
INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, fx_rate, fx_source, amount_base)
VALUES (tests.get('b_tx_id'), tests.get('b_household_id'), tests.get('b_profile_id'), 'expense', now(), tests.get('b_account_id'), 100000, 'ARS', 1, 'identity', 100000);

SELECT tests.authenticate_as(tests.get('a_profile_id'));

-- Preflight, antes de escribir nada: 2 identity (la USD ya resuelta + la
-- USD pending, las dos con currency_code = la base nueva) + 1 reset (la ARS).
SELECT tests.log(is(
  (public.preflight_change_base_currency(tests.get('a_household_id'), 'USD') ->> 'identityCount')::int,
  2,
  'preflight cuenta 2 transacciones que pasan a identidad'
));
SELECT tests.log(is(
  (public.preflight_change_base_currency(tests.get('a_household_id'), 'USD') ->> 'resetCount')::int,
  1,
  'preflight cuenta 1 transacción que se descarta a pending'
));

SELECT tests.log(throws_ok(
  format($$SELECT public.change_household_base_currency(%L, 'USD')$$, tests.get('b_household_id')),
  'Solo un admin del household puede cambiar la moneda base',
  'A no puede cambiar la moneda base del household de B'
));

SELECT public.change_household_base_currency(tests.get('a_household_id'), 'USD');

SELECT tests.log(is(
  (SELECT base_currency FROM public.households WHERE id = tests.get('a_household_id')),
  'USD',
  'households.base_currency queda en USD'
));

-- (1) ARS: descartada a pending, nunca recalculada.
SELECT tests.log(is((SELECT fx_rate FROM public.transactions WHERE id = tests.get('a_ars_tx_id')), NULL::numeric, 'ARS: fx_rate vuelve a NULL, nunca se recalcula'));
SELECT tests.log(is((SELECT fx_source FROM public.transactions WHERE id = tests.get('a_ars_tx_id')), 'pending', 'ARS: fx_source vuelve a pending'));
SELECT tests.log(is((SELECT amount_base FROM public.transactions WHERE id = tests.get('a_ars_tx_id')), NULL::bigint, 'ARS: amount_base vuelve a NULL'));

-- (2) USD ya resuelta: identidad exacta, no conserva el 1.28 viejo.
SELECT tests.log(is((SELECT fx_rate FROM public.transactions WHERE id = tests.get('a_usd_tx_id')), 1::numeric, 'USD: fx_rate pasa a 1 exacto (identidad), no el 1.28 inherited viejo'));
SELECT tests.log(is((SELECT fx_source FROM public.transactions WHERE id = tests.get('a_usd_tx_id')), 'identity', 'USD: fx_source pasa a identity'));
SELECT tests.log(is((SELECT amount_base FROM public.transactions WHERE id = tests.get('a_usd_tx_id')), 10000::bigint, 'USD: amount_base = amount (rate 1)'));

-- (3) USD pending: se resuelve gratis, identidad exacta.
SELECT tests.log(is((SELECT fx_rate FROM public.transactions WHERE id = tests.get('a_usd_pending_tx_id')), 1::numeric, 'USD pending: se resuelve a identidad, no queda pending'));
SELECT tests.log(is((SELECT fx_source FROM public.transactions WHERE id = tests.get('a_usd_pending_tx_id')), 'identity', 'USD pending: fx_source pasa a identity'));
SELECT tests.log(is((SELECT amount_base FROM public.transactions WHERE id = tests.get('a_usd_pending_tx_id')), 5000::bigint, 'USD pending: amount_base = amount (rate 1)'));

-- split hijo de (1): cae a pending junto con el padre — el trigger
-- BEFORE UPDATE no corre solo, la función lo tiene que tocar a mano.
SELECT tests.log(is((SELECT amount_base FROM public.transaction_splits WHERE id = tests.get('a_split_id')), NULL::bigint, 'split hijo: amount_base vuelve a NULL'));
SELECT tests.log(is((SELECT fx_source FROM public.transaction_splits WHERE id = tests.get('a_split_id')), 'pending', 'split hijo: fx_source vuelve a pending'));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.audit_log WHERE household_id = tests.get('a_household_id') AND action = 'base_currency_changed'),
  1,
  'queda una fila de audit_log por el cambio'
));

-- Correr de nuevo con la misma moneda es un no-op explícito, no un error.
SELECT tests.log(is(
  (public.change_household_base_currency(tests.get('a_household_id'), 'USD') ->> 'changed')::boolean,
  false,
  'cambiar a la misma moneda que ya es la base es un no-op'
));

-- B: ni un movimiento tocado por el cambio de A — chequeado bypaseando RLS
-- (si no, A ni siquiera puede VER la fila de B, y un NULL por invisibilidad
-- se confundiría con un NULL por haber sido tocada).
SELECT tests.clear_authentication();
SELECT tests.log(is((SELECT fx_rate FROM public.transactions WHERE id = tests.get('b_tx_id')), 1::numeric, 'el cambio de A no toca fx_rate de un movimiento de B'));
SELECT tests.log(is((SELECT base_currency FROM public.households WHERE id = tests.get('b_household_id')), 'ARS', 'el cambio de A no toca la base de B'));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
