-- GATE-1 + § 2.4b: visibilidad 'custom' vía visibility_grants/can_see().
-- Un tercer miembro del MISMO household (no dueño de la cuenta) solo ve una
-- cuenta 'private' si tiene un grant vigente; un miembro de OTRO household
-- nunca la ve aunque tenga un grant con el subject_id correcto (grants_all
-- valida que subject_id pertenezca al household del grant).
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(5));

SELECT tests.clear_authentication();
SELECT tests.setup_household('a', 'vis-household-a');
SELECT tests.setup_user('a2', 'vis-a-member2@test.perze.local');
INSERT INTO public.household_members (household_id, profile_id, role, status, joined_at)
VALUES (tests.get('a_household_id'), tests.get('a2_profile_id'), 'member', 'active', now());

SELECT tests.setup_household('c', 'vis-household-c');

-- cuenta 'private' del owner de A
SELECT tests.stash('private_account_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, visibility, created_by)
VALUES (tests.get('private_account_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'Cuenta privada de A', 'checking', 'ARS', 'private', tests.get('a_profile_id'));

SELECT tests.authenticate_as(tests.get('a2_profile_id'));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.accounts WHERE id = tests.get('private_account_id')),
  0,
  'el segundo miembro de A no ve la cuenta private del owner sin grant'
));

-- el owner de A le da un grant 'custom' al segundo miembro (requiere
-- primero cambiar la cuenta a visibility='custom', que es el camino real)
SELECT tests.clear_authentication();
UPDATE public.accounts SET visibility = 'custom' WHERE id = tests.get('private_account_id');
INSERT INTO public.visibility_grants (id, household_id, subject_type, subject_id, member_id, granted_by)
VALUES (gen_random_uuid(), tests.get('a_household_id'), 'account', tests.get('private_account_id'), tests.get('a2_profile_id'), tests.get('a_profile_id'));

SELECT tests.authenticate_as(tests.get('a2_profile_id'));
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.accounts WHERE id = tests.get('private_account_id')),
  1,
  'con un grant vigente, el segundo miembro SÍ ve la cuenta custom'
));

-- revoco el grant: vuelve a no verse
SELECT tests.clear_authentication();
UPDATE public.visibility_grants SET revoked_at = now()
WHERE subject_id = tests.get('private_account_id') AND member_id = tests.get('a2_profile_id');

SELECT tests.authenticate_as(tests.get('a2_profile_id'));
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.accounts WHERE id = tests.get('private_account_id')),
  0,
  'al revocar el grant, deja de verse otra vez'
));

-- un miembro de OTRO household (C) nunca ve la cuenta de A aunque conozca
-- el subject_id, porque la primera condición de accounts_select ya filtra
-- por household_id IN current_households()
SELECT tests.authenticate_as(tests.get('c_profile_id'));
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.accounts WHERE id = tests.get('private_account_id')),
  0,
  'un miembro de household C nunca ve la cuenta de A, con o sin grant'
));

-- el WITH CHECK de visibility_grants valida que subject_id pertenezca al
-- household del grant: C no puede otorgarse a sí mismo acceso a la cuenta
-- de A declarando su propio household_id
SELECT tests.log(throws_ok(
  format(
    $$INSERT INTO public.visibility_grants (id, household_id, subject_type, subject_id, member_id, granted_by)
      VALUES (gen_random_uuid(), %L, 'account', %L, %L, %L)$$,
    tests.get('c_household_id'), tests.get('private_account_id'), tests.get('c_profile_id'), tests.get('c_profile_id')
  ),
  'new row violates row-level security policy for table "visibility_grants"',
  'C no puede otorgarse acceso a una cuenta de A declarando su propio household_id'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
