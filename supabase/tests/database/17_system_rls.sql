-- GATE-1: settlements, rules, insights (solo sistema escribe), audit_log
-- (append-only, sin UPDATE/DELETE), import_batches.
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(13));

SELECT tests.clear_authentication();
SELECT tests.setup_household('a', 'sys-household-a');
SELECT tests.setup_household('b', 'sys-household-b');
SELECT tests.setup_user('a2', 'sys-a-member2@test.perze.local');
INSERT INTO public.household_members (household_id, profile_id, role, status, joined_at)
VALUES (tests.get('a_household_id'), tests.get('a2_profile_id'), 'member', 'active', now());

SELECT tests.stash('b_settlement_id', gen_random_uuid());
INSERT INTO public.settlements (id, household_id, from_member, to_member, amount, currency_code, method, created_by)
VALUES (tests.get('b_settlement_id'), tests.get('b_household_id'), tests.get('b_profile_id'), tests.get('b_profile_id'), 50000, 'ARS', 'cash', tests.get('b_profile_id'));

SELECT tests.stash('a_settlement_id', gen_random_uuid());
INSERT INTO public.settlements (id, household_id, from_member, to_member, amount, currency_code, method, created_by)
VALUES (tests.get('a_settlement_id'), tests.get('a_household_id'), tests.get('a_profile_id'), tests.get('a2_profile_id'), 30000, 'ARS', 'cash', tests.get('a_profile_id'));

SELECT tests.stash('a_rule_id', gen_random_uuid());
INSERT INTO public.rules (id, household_id, name, match, actions, created_by)
VALUES (tests.get('a_rule_id'), tests.get('a_household_id'), 'Uber → Transporte', '{}'::jsonb, '{}'::jsonb, tests.get('a_profile_id'));

SELECT tests.stash('a_insight_id', gen_random_uuid());
INSERT INTO public.insights (id, household_id, kind, severity, payload)
VALUES (tests.get('a_insight_id'), tests.get('a_household_id'), 'anomaly', 'info', '{}'::jsonb);

SELECT tests.stash('a_batch_id', gen_random_uuid());
INSERT INTO public.import_batches (id, household_id, filename, status, created_by)
VALUES (tests.get('a_batch_id'), tests.get('a_household_id'), 'movimientos.csv', 'pending', tests.get('a_profile_id'));

SELECT tests.authenticate_as(tests.get('a_profile_id'));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.settlements WHERE household_id = tests.get('b_household_id')),
  0,
  'A no puede leer settlements de B'
));

SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.settlements SET household_id = %L WHERE id = %L$$,
    tests.get('b_household_id'), tests.get('a_settlement_id')
  ),
  'new row violates row-level security policy for table "settlements"',
  'A no puede mover su settlement al household de B'
));

UPDATE public.settlements SET deleted_at = now() WHERE id = tests.get('a_settlement_id');
SELECT tests.log(isnt(
  (SELECT deleted_at FROM public.settlements WHERE id = tests.get('a_settlement_id')),
  NULL,
  'A puede soft-deletear su propio settlement'
));

DELETE FROM public.settlements WHERE id = tests.get('a_settlement_id');
SELECT tests.clear_authentication();
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.settlements WHERE id = tests.get('a_settlement_id')),
  1,
  'DELETE real sobre settlements no tuvo efecto: no hay policy de DELETE'
));

SELECT tests.authenticate_as(tests.get('a_profile_id'));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.rules WHERE household_id = tests.get('b_household_id')),
  0,
  'A no puede leer reglas de auto-categorización de B'
));

SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.rules SET household_id = %L WHERE id = %L$$,
    tests.get('b_household_id'), tests.get('a_rule_id')
  ),
  'new row violates row-level security policy for table "rules"',
  'A no puede mover su regla al household de B'
));

-- insights: el sistema las genera (sin created_by), el cliente solo puede
-- descartarlas (dismiss vía UPDATE de dismissed_at), nunca insertar
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.insights WHERE id = tests.get('a_insight_id')),
  1,
  'A puede leer su propio insight'
));

SELECT tests.log(throws_ok(
  $$INSERT INTO public.insights (id, household_id, kind, severity, payload) VALUES (gen_random_uuid(), gen_random_uuid(), 'x', 'info', '{}'::jsonb)$$,
  NULL,
  'A no puede insertar un insight (los genera el sistema, sin policy de INSERT para authenticated)'
));

UPDATE public.insights SET dismissed_at = now() WHERE id = tests.get('a_insight_id');
SELECT tests.log(isnt(
  (SELECT dismissed_at FROM public.insights WHERE id = tests.get('a_insight_id')),
  NULL,
  'A puede descartar (dismiss) su propio insight'
));

-- audit_log: append-only, A puede insertar su propia entrada pero nunca
-- editarla ni borrarla
SELECT tests.log(lives_ok(
  format(
    $$INSERT INTO public.audit_log (household_id, actor_id, entity, entity_id, action) VALUES (%L, %L, 'transactions', gen_random_uuid(), 'update')$$,
    tests.get('a_household_id'), tests.get('a_profile_id')
  ),
  'A puede insertar su propia entrada de audit_log'
));

-- sin policy de UPDATE, la fila no es "actualizable": el UPDATE es un
-- no-op silencioso (0 filas), no una excepción — mismo patrón que DELETE
-- sin policy (ver 10_accounts_rls).
UPDATE public.audit_log SET action = 'borrado' WHERE household_id = tests.get('a_household_id');
SELECT tests.clear_authentication();
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.audit_log WHERE household_id = tests.get('a_household_id') AND action = 'borrado'),
  0,
  'nadie puede editar audit_log (sin policy de UPDATE, append-only): el intento no tuvo efecto'
));
SELECT tests.authenticate_as(tests.get('a_profile_id'));

-- import_batches
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.import_batches WHERE id = tests.get('a_batch_id')),
  1,
  'A puede leer su propio import_batch'
));

SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.import_batches SET household_id = %L WHERE id = %L$$,
    tests.get('b_household_id'), tests.get('a_batch_id')
  ),
  NULL,
  'A no puede mover su import_batch al household de B'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
