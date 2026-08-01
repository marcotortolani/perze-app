-- GATE-1: la capa de identidad (household_members, household_invites,
-- household_fx_preferences, profiles) se usó como fixture en todos los
-- tests anteriores, pero nunca tuvo su propio test adversarial.
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(9));

SELECT tests.clear_authentication();
SELECT tests.setup_household('a', 'id-household-a');
SELECT tests.setup_household('b', 'id-household-b');

SELECT tests.stash('a_pref_household_id', tests.get('a_household_id'));
INSERT INTO public.household_fx_preferences (household_id, currency_pair, preferred_provider)
VALUES (tests.get('a_household_id'), 'ARS/USD', 'dolarapi');

SELECT tests.stash('b_invite_id', gen_random_uuid());
INSERT INTO public.household_invites (id, household_id, code, role, expires_at)
VALUES (tests.get('b_invite_id'), tests.get('b_household_id'), 'B-CODE-1', 'member', now() + interval '7 days');

SELECT tests.authenticate_as(tests.get('a_profile_id'));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.household_members WHERE household_id = tests.get('b_household_id')),
  0,
  'A no puede leer los miembros del household de B'
));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.household_invites WHERE id = tests.get('b_invite_id')),
  0,
  'A no puede leer las invitaciones pendientes de B'
));

-- USING ya filtra la fila (household_id no está en current_households() de
-- A): el UPDATE es un no-op silencioso, no una excepción.
UPDATE public.household_members SET role = 'admin' WHERE household_id = tests.get('b_household_id') AND profile_id = tests.get('b_profile_id');
SELECT tests.clear_authentication();
SELECT tests.log(is(
  (SELECT role FROM public.household_members WHERE household_id = tests.get('b_household_id') AND profile_id = tests.get('b_profile_id')),
  'owner',
  'A no puede promover a nadie en el household de B (USING ya filtra la fila)'
));
SELECT tests.authenticate_as(tests.get('a_profile_id'));

-- A SÍ puede editar su propio rol de member/admin dentro de su household
-- (household_members_update exige ser owner/admin del household)
UPDATE public.household_members SET display_name = 'A (mí)' WHERE household_id = tests.get('a_household_id') AND profile_id = tests.get('a_profile_id');
SELECT tests.log(is(
  (SELECT display_name FROM public.household_members WHERE household_id = tests.get('a_household_id') AND profile_id = tests.get('a_profile_id')),
  'A (mí)',
  'A (owner) puede editar su propia fila de household_members'
));

-- intento de mover la fila de household_members al household de B —
-- household_id es PK compuesta (household_id, profile_id) y household_id
-- es inmutable, ver household_members_update
SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.household_members SET household_id = %L WHERE household_id = %L AND profile_id = %L$$,
    tests.get('b_household_id'), tests.get('a_household_id'), tests.get('a_profile_id')
  ),
  -- A5: protección real vía trigger household_members_immutable, no el WITH CHECK (tautológico).
  'La columna household_id es inmutable en household_members',
  'A no puede mover su propia membresía al household de B'
));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.household_fx_preferences WHERE household_id = tests.get('b_household_id')),
  0,
  'A no puede leer las preferencias de FX de B'
));

SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.household_fx_preferences SET household_id = %L WHERE household_id = %L AND currency_pair = 'ARS/USD'$$,
    tests.get('b_household_id'), tests.get('a_household_id')
  ),
  -- A5: protección real vía trigger household_fx_preferences_immutable, no el WITH CHECK (tautológico).
  'La columna household_id es inmutable en household_fx_preferences',
  'A no puede mover su preferencia de FX al household de B'
));

-- profiles: A solo ve/edita su propio profile, ancla en auth.uid(), no en household
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.profiles WHERE id = tests.get('b_profile_id')),
  0,
  'A no puede leer el profile de B (ancla en auth.uid(), no en household)'
));

-- USING (id = auth.uid()) ya filtra la fila de B: no-op silencioso.
UPDATE public.profiles SET display_name = 'hackeado' WHERE id = tests.get('b_profile_id');
SELECT tests.clear_authentication();
SELECT tests.log(isnt(
  (SELECT display_name FROM public.profiles WHERE id = tests.get('b_profile_id')),
  'hackeado',
  'A no puede editar el profile de B (USING ya filtra la fila)'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
