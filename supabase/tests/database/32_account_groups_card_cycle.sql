-- Tanda 4 — account_groups (multi-moneda de tarjeta) + ciclo por
-- proyección/confirmación (20260812090000_account_groups_card_multicurrency.sql).
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(9));

SELECT tests.clear_authentication();
SELECT tests.setup_household('cg', 'card-groups-household-a');
SELECT tests.setup_household('cg2', 'card-groups-household-b');
SELECT tests.authenticate_as(tests.get('cg_profile_id'));

-- Un grupo de tarjeta: límite y ciclo compartidos, dueño del
-- statement_day/due_day que antes vivía en cada cuenta.
SELECT tests.stash('cg_group_id', gen_random_uuid());
INSERT INTO public.account_groups (id, household_id, kind, name, credit_limit, limit_currency, statement_day, due_day, created_by)
VALUES (tests.get('cg_group_id'), tests.get('cg_household_id'), 'credit_card', 'Visa BBVA', 2000000, 'ARS', 5, 15, tests.get('cg_profile_id'));

-- Dos cuentas de tarjeta, distinta moneda, mismo grupo — el mecanismo
-- multi-moneda que ya existía para cajas de ahorro, reusado acá.
SELECT tests.stash('cg_ars_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, account_group_id, created_by)
VALUES (tests.get('cg_ars_id'), tests.get('cg_household_id'), tests.get('cg_profile_id'), 'Visa BBVA ARS', 'credit_card', 'ARS', tests.get('cg_group_id'), tests.get('cg_profile_id'));

SELECT tests.stash('cg_usd_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, account_group_id, created_by)
VALUES (tests.get('cg_usd_id'), tests.get('cg_household_id'), tests.get('cg_profile_id'), 'Visa BBVA USD', 'credit_card', 'USD', tests.get('cg_group_id'), tests.get('cg_profile_id'));

-- Un consumo en cada moneda, dentro del ciclo actual.
SELECT tests.stash('cg_cat_id', gen_random_uuid());
INSERT INTO public.categories (id, household_id, name, kind, created_by)
VALUES (tests.get('cg_cat_id'), tests.get('cg_household_id'), 'Compras', 'expense', tests.get('cg_profile_id'));

INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, category_id, fx_rate, fx_source, amount_base)
VALUES (gen_random_uuid(), tests.get('cg_household_id'), tests.get('cg_profile_id'), 'expense', now(), tests.get('cg_ars_id'), 50000, 'ARS', tests.get('cg_cat_id'), 1, 'identity', 50000);
INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, category_id, fx_rate, fx_source, amount_base)
VALUES (gen_random_uuid(), tests.get('cg_household_id'), tests.get('cg_profile_id'), 'expense', now(), tests.get('cg_usd_id'), 100, 'USD', tests.get('cg_cat_id'), 1000, 'identity', 100000);

SELECT public.open_card_statements();

-- Las dos cuentas del grupo abrieron resumen — leyendo statement_day/due_day
-- del GRUPO, no de la cuenta (que acá está en NULL).
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.card_statements WHERE account_id = tests.get('cg_ars_id') AND status = 'open'),
  1,
  'open_card_statements abre resumen para la cuenta ARS usando el ciclo del grupo'
));
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.card_statements WHERE account_id = tests.get('cg_usd_id') AND status = 'open'),
  1,
  'open_card_statements abre resumen para la cuenta USD del mismo grupo, por separado'
));

-- Los dos nacen como proyección, nunca confirmados de entrada.
SELECT tests.log(is(
  (SELECT projection_status FROM public.card_statements WHERE account_id = tests.get('cg_ars_id') AND status = 'open'),
  'projected',
  'un resumen recién abierto nace projected, nunca confirmed'
));

-- Cada resumen suma solo los consumos de SU moneda — nunca se mezclan.
SELECT tests.log(is(
  (SELECT statement_balance FROM public.card_statements WHERE account_id = tests.get('cg_ars_id') AND status = 'open'),
  50000::bigint,
  'el resumen ARS solo suma los consumos en ARS'
));
SELECT tests.log(is(
  (SELECT statement_balance FROM public.card_statements WHERE account_id = tests.get('cg_usd_id') AND status = 'open'),
  100::bigint,
  'el resumen USD solo suma los consumos en USD — no el equivalente convertido'
));

-- El bug que esta migración arregla: correr open_card_statements() de
-- nuevo (como el cron todos los días) NUNCA cierra un resumen por fecha,
-- ni aunque closing_date ya haya pasado.
UPDATE public.card_statements SET closing_date = current_date - 5 WHERE account_id = tests.get('cg_ars_id') AND status = 'open';
SELECT public.open_card_statements();
SELECT tests.log(is(
  (SELECT status FROM public.card_statements WHERE account_id = tests.get('cg_ars_id') ORDER BY period_start DESC LIMIT 1),
  'open',
  'open_card_statements nunca cierra un ciclo por fecha — el cierre real es confirm_card_statement'
));

-- Confirmación manual: pisa cierre/vencimiento/total con lo que dice el
-- banco, cierra de verdad y abre el próximo ciclo como proyección.
SELECT tests.stash('cg_open_statement_id', (SELECT id FROM public.card_statements WHERE account_id = tests.get('cg_ars_id') AND status = 'open'));
SELECT public.confirm_card_statement(tests.get('cg_open_statement_id'), current_date, current_date + 10, 55000);

SELECT tests.log(is(
  (SELECT status FROM public.card_statements WHERE id = tests.get('cg_open_statement_id')),
  'closed',
  'confirm_card_statement cierra de verdad el resumen confirmado'
));
SELECT tests.log(is(
  (SELECT projection_status FROM public.card_statements WHERE id = tests.get('cg_open_statement_id')),
  'confirmed',
  'confirm_card_statement marca projection_status = confirmed'
));
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.card_statements WHERE account_id = tests.get('cg_ars_id') AND status = 'open' AND projection_status = 'projected'),
  1,
  'confirm_card_statement abre el próximo ciclo como proyección, para no quedar sin "ciclo actual"'
));

-- Cross-household: B no puede confirmar un resumen de A.
SELECT tests.authenticate_as(tests.get('cg2_profile_id'));
SELECT tests.log(throws_ok(
  format($$SELECT public.confirm_card_statement(%L, current_date, current_date + 10, 1000)$$, tests.get('cg_open_statement_id')),
  'No podés escribir en este household',
  'un household ajeno no puede confirmar el resumen de otro'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
