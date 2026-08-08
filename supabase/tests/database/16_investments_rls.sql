-- GATE-1: portfolios (raíz) + trades/target_allocations/portfolio_snapshots
-- (hijas) + price_snapshots (Patrón C con precios manuales por household,
-- desde 20260806090000_investment_prices_infra.sql + el hardening de
-- 20260808100000_security_hardening_prices_cron_households.sql).
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(13));

SELECT tests.clear_authentication();
SELECT tests.setup_household('a', 'inv-household-a');
SELECT tests.setup_household('b', 'inv-household-b');

SELECT tests.stash('b_portfolio_id', gen_random_uuid());
INSERT INTO public.portfolios (id, household_id, name, base_currency, created_by)
VALUES (tests.get('b_portfolio_id'), tests.get('b_household_id'), 'Cartera de B', 'ARS', tests.get('b_profile_id'));

SELECT tests.stash('a_portfolio_id', gen_random_uuid());
INSERT INTO public.portfolios (id, household_id, name, base_currency, created_by)
VALUES (tests.get('a_portfolio_id'), tests.get('a_household_id'), 'Cartera de A', 'ARS', tests.get('a_profile_id'));

SELECT tests.stash('instrument_id', gen_random_uuid());
INSERT INTO public.instruments (id, household_id, symbol, name, currency_code)
VALUES (tests.get('instrument_id'), NULL, 'AAPL', 'Apple Inc', 'USD');

-- Instrumento privado de B (clon Patrón C, household_id propio) — para
-- probar que su valuación manual NO es legible por A.
SELECT tests.stash('b_instrument_id', gen_random_uuid());
INSERT INTO public.instruments (id, household_id, symbol, name, currency_code)
VALUES (tests.get('b_instrument_id'), tests.get('b_household_id'), 'FCI-B', 'FCI privado de B', 'ARS');

INSERT INTO public.price_snapshots (instrument_id, as_of, provider, close, currency_code)
VALUES (tests.get('b_instrument_id'), current_date, 'manual', 100, 'ARS');

SELECT tests.stash('a_trade_id', gen_random_uuid());
INSERT INTO public.trades (id, portfolio_id, instrument_id, created_by, kind, executed_at, quantity, price, currency_code, gross_amount, net_amount)
VALUES (tests.get('a_trade_id'), tests.get('a_portfolio_id'), tests.get('instrument_id'), tests.get('a_profile_id'), 'buy', now(), 10, 15000, 'USD', 150000, 150000);

SELECT tests.stash('a_alloc_id', gen_random_uuid());
INSERT INTO public.target_allocations (id, portfolio_id, dimension, key, target_pct)
VALUES (tests.get('a_alloc_id'), tests.get('a_portfolio_id'), 'currency', 'USD', 60);

INSERT INTO public.portfolio_snapshots (portfolio_id, as_of, market_value, cost_basis)
VALUES (tests.get('a_portfolio_id'), current_date, 150000, 150000);

SELECT tests.authenticate_as(tests.get('a_profile_id'));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.portfolios WHERE household_id = tests.get('b_household_id')),
  0,
  'A no puede leer carteras de B'
));

SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.portfolios SET household_id = %L WHERE id = %L$$,
    tests.get('b_household_id'), tests.get('a_portfolio_id')
  ),
  -- A5: protección real vía trigger portfolios_immutable, no el WITH CHECK (tautológico).
  'La columna household_id es inmutable en portfolios',
  'A no puede mover su cartera al household de B'
));

UPDATE public.portfolios SET deleted_at = now() WHERE id = tests.get('a_portfolio_id');
SELECT tests.log(isnt(
  (SELECT deleted_at FROM public.portfolios WHERE id = tests.get('a_portfolio_id')),
  NULL,
  'A puede soft-deletear su propia cartera'
));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.trades WHERE id = tests.get('a_trade_id')),
  1,
  'los trades de A siguen visibles después del soft-delete de la cartera (RLS ya no filtra por deleted_at, ni del padre)'
));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.target_allocations WHERE id = tests.get('a_alloc_id')),
  1,
  'los target_allocations de A siguen visibles después del soft-delete de la cartera'
));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.portfolio_snapshots WHERE portfolio_id = tests.get('a_portfolio_id')),
  1,
  'los portfolio_snapshots de A siguen visibles después del soft-delete de la cartera'
));

SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.trades SET portfolio_id = %L WHERE id = %L$$,
    tests.get('b_portfolio_id'), tests.get('a_trade_id')
  ),
  'new row violates row-level security policy for table "trades"',
  'A no puede mover su trade a la cartera de B (portfolio_id inmutable)'
));

DELETE FROM public.trades WHERE id = tests.get('a_trade_id');
SELECT tests.clear_authentication();
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.trades WHERE id = tests.get('a_trade_id')),
  1,
  'DELETE real sobre trades no tuvo efecto: no hay policy de DELETE (mismo criterio CON-24)'
));

-- price_snapshots: dato de mercado global legible por cualquiera; precios
-- MANUALES acotados al household del instrumento (20260806090000 +
-- 20260808100000_security_hardening_prices_cron_households.sql).
INSERT INTO public.price_snapshots (instrument_id, as_of, provider, close, currency_code)
VALUES (tests.get('instrument_id'), current_date, 'manual', 15500, 'USD');

SELECT tests.authenticate_as(tests.get('a_profile_id'));
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.price_snapshots WHERE instrument_id = tests.get('instrument_id')),
  1,
  'price_snapshots de un instrumento global es legible por cualquier autenticado'
));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.price_snapshots WHERE instrument_id = tests.get('b_instrument_id')),
  0,
  'A no puede leer el precio manual que B cargó para su instrumento privado'
));

SELECT tests.log(lives_ok(
  format(
    $$INSERT INTO public.price_snapshots (instrument_id, as_of, provider, close, currency_code) VALUES (%L, current_date + 1, 'manual', 16000, 'USD')$$,
    tests.get('instrument_id')
  ),
  'un autenticado puede cargar un precio manual sobre un instrumento que puede ver'
));

SELECT tests.log(throws_ok(
  format(
    $$INSERT INTO public.price_snapshots (instrument_id, as_of, provider, close, currency_code) VALUES (%L, current_date + 2, 'data912', 16500, 'USD')$$,
    tests.get('instrument_id')
  ),
  'new row violates row-level security policy for table "price_snapshots"',
  'un autenticado no puede insertar con un provider real (solo cron/Edge Functions con service_role)'
));

SELECT tests.log(throws_ok(
  format(
    $$INSERT INTO public.price_snapshots (instrument_id, as_of, provider, close, currency_code) VALUES (%L, current_date + 1, 'manual', 999, 'ARS')$$,
    tests.get('b_instrument_id')
  ),
  'new row violates row-level security policy for table "price_snapshots"',
  'A no puede cargar un precio manual sobre el instrumento privado de B'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
