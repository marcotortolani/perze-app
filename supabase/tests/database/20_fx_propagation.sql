-- A6 (auditoría técnica) — transaction_splits/transaction_shares con
-- fx_source real, y propagación cuando el padre resuelve un pending
-- DESPUÉS de que el hijo ya existía (antes: quedaban en NULL para
-- siempre, el trigger de herencia solo miraba el estado del padre al
-- momento de insertar/actualizar el hijo).
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(6));

SELECT tests.clear_authentication();
SELECT tests.setup_household('a', 'fxprop-household-a');

SELECT tests.stash('a_account_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, created_by)
VALUES (tests.get('a_account_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'Cuenta de A', 'checking', 'ARS', tests.get('a_profile_id'));

-- Household base_currency es ARS por defecto en tests.create_household (ver 00_setup.sql) —
-- currency_code de la transacción también ARS: fx identity, así que se
-- fuerza fx_source='pending' a mano para simular el needs_fx real.
SELECT tests.stash('a_tx_id', gen_random_uuid());
INSERT INTO public.transactions (
  id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, fx_source, fx_rate, amount_base
)
VALUES (
  tests.get('a_tx_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'expense', now(),
  tests.get('a_account_id'), 100000, 'ARS', 'pending', NULL, NULL
);

SELECT tests.stash('a_split_id', gen_random_uuid());
INSERT INTO public.transaction_splits (id, transaction_id, category_id, amount)
VALUES (tests.get('a_split_id'), tests.get('a_tx_id'), NULL, 40000);

SELECT tests.log(is(
  (SELECT fx_source FROM public.transaction_splits WHERE id = tests.get('a_split_id')),
  'pending',
  'el split hereda pending del padre al insertarse'
));

SELECT tests.log(is(
  (SELECT amount_base FROM public.transaction_splits WHERE id = tests.get('a_split_id')),
  NULL,
  'amount_base del split queda NULL mientras el padre está pending'
));

-- El padre resuelve su pending (equivalente a resolvePendingFx del lado
-- cliente). fx_rate es numeric(24,12) plano acá — 1, no el bigint
-- escalado x10^12 que usa el cliente (ese es justo el bug de A1).
UPDATE public.transactions
SET fx_rate = 1, fx_source = 'manual', amount_base = 100000
WHERE id = tests.get('a_tx_id');

SELECT tests.log(is(
  (SELECT fx_source FROM public.transaction_splits WHERE id = tests.get('a_split_id')),
  'manual',
  'A6: el split se resuelve solo cuando el padre resuelve su pending (propagación)'
));

SELECT tests.log(is(
  (SELECT amount_base FROM public.transaction_splits WHERE id = tests.get('a_split_id')),
  40000::bigint,
  'amount_base del split se recalcula a partir del rate del padre (mismas monedas, rate 1)'
));

-- CHECK pareado: existe en el catálogo (no se puede probar disparándolo vía
-- INSERT normal — el trigger inherit_fx_state_splits ya corrige/rechaza
-- cualquier combinación inconsistente ANTES de que el CHECK la vea; el
-- CHECK es el backstop de esquema, no el camino que ejercita la app).
SELECT tests.log(is(
  (SELECT count(*)::int FROM pg_constraint WHERE conname = 'transaction_splits_fx_pair'),
  1,
  'CHECK pareado transaction_splits_fx_pair existe'
));

-- Un segundo split creado DESPUÉS de que el padre ya resolvió nace resuelto directo (vía inherit_fx_state_splits), no pending.
SELECT tests.stash('a_split2_id', gen_random_uuid());
INSERT INTO public.transaction_splits (id, transaction_id, category_id, amount, amount_base)
VALUES (tests.get('a_split2_id'), tests.get('a_tx_id'), NULL, 60000, 60000);

SELECT tests.log(is(
  (SELECT fx_source FROM public.transaction_splits WHERE id = tests.get('a_split2_id')),
  'manual',
  'un split nuevo sobre un padre ya resuelto nace con el fx_source del padre, no pending'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
