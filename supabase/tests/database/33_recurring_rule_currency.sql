-- Recurrentes con moneda distinta a la de la cuenta
-- (`20260812130000_recurring_rule_currency.sql`,
-- `20260812130100_recurring_rule_currency_defer_no_capture_rate.sql`): la
-- regla pacta el monto en una moneda, la cuenta que la paga es de otra, la
-- conversión se resuelve a la fecha de la ocurrencia. Dos casos: con
-- cotización cargada (convierte y guarda la terna `original_*`) y sin
-- ella (la corrida automática DIFIERE la ocurrencia entera — nunca inserta
-- un `amount = 0`, que violaría `amount_sign`).
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(4));

SELECT tests.clear_authentication();
SELECT tests.setup_household('rc', 'recurring-currency-household');

-- Cuenta en USD; regla pactada en UYU (alquiler pagado desde una cuenta en
-- dólares) — el household queda en ARS por `create_household`, así que de
-- paso ejercita las DOS conversiones encadenadas (UYU→USD, USD→ARS).
SELECT tests.stash('rc_account_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, opening_balance, created_by)
VALUES (tests.get('rc_account_id'), tests.get('rc_household_id'), tests.get('rc_profile_id'), 'Itaú Dólares', 'checking', 'USD', 100000000, tests.get('rc_profile_id'));

SELECT tests.stash('rc_rule_id', gen_random_uuid());
INSERT INTO public.recurring_rules (id, household_id, name, kind, account_id, expected_amount, currency_code, frequency, anchor_date, day_of_month, auto_post, created_by)
VALUES (
  tests.get('rc_rule_id'), tests.get('rc_household_id'), 'Alquiler', 'expense', tests.get('rc_account_id'), 4000000, 'UYU',
  'monthly', current_date, extract(day FROM current_date)::int, true, tests.get('rc_profile_id')
);

-- `fx_rates` es un caché GLOBAL (no por household) que puede tener datos
-- reales de uso previo en esta base de desarrollo compartida — se limpia
-- el par para este test, dentro de la transacción que hace ROLLBACK al
-- final, así "sin cotización" es determinístico sin importar qué haya
-- quedado cacheado.
DELETE FROM public.fx_rates WHERE base = 'UYU' AND quote = 'USD';

-- Sin ninguna cotización cargada todavía: la corrida automática difiere la
-- ocurrencia entera — nunca un movimiento fantasma en $0.
SELECT public.materialize_recurring_transactions();

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.transactions WHERE recurring_id = tests.get('rc_rule_id')),
  0,
  'sin cotización para la primera conversión: no inserta nada (evita el amount=0 que viola amount_sign)'
));
SELECT tests.log(is(
  (SELECT last_materialized_on FROM public.recurring_rules WHERE id = tests.get('rc_rule_id')),
  NULL::date,
  'y no avanza last_materialized_on — la ocurrencia se reintenta en la próxima corrida'
));

-- Con cotización cargada (override manual, UYU → USD): la misma corrida
-- convierte de verdad.
INSERT INTO public.fx_overrides (id, household_id, base_currency, quote_currency, rate, valid_from, created_by)
VALUES (gen_random_uuid(), tests.get('rc_household_id'), 'UYU', 'USD', 0.025, (current_date - interval '1 month')::date, tests.get('rc_profile_id'));

SELECT public.materialize_recurring_transactions();

SELECT tests.log(is(
  (SELECT amount FROM public.transactions WHERE recurring_id = tests.get('rc_rule_id') ORDER BY occurred_at LIMIT 1),
  100000::bigint, -- UYU 40.000,00 * 0,025 = USD 1.000,00 (100.000 unidades mínimas, 2 decimales)
  'con cotización: convierte UYU → USD antes de posar en la cuenta'
));
SELECT tests.log(is(
  (SELECT currency_code FROM public.transactions WHERE recurring_id = tests.get('rc_rule_id') ORDER BY occurred_at LIMIT 1),
  'USD',
  'la transacción queda en la moneda de la CUENTA, no en la de la regla'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
