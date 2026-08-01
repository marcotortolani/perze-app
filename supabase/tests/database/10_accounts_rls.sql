-- GATE-1 (docs/plan-de-trabajo.md § 2): household A no puede leer, insertar,
-- actualizar ni mover una fila de accounts que pertenece a household B.
--
-- Cada aserción pgTAP se envuelve en tests.log(...) porque `supabase db
-- query -f` solo devuelve las filas del último statement — sin esto no se
-- ve el resultado de nada salvo la última línea. El SELECT final lee todo
-- el log acumulado antes del ROLLBACK.
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(9));

SELECT tests.clear_authentication();
SELECT tests.setup_household('a', 'household-a');
SELECT tests.setup_household('b', 'household-b');

INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, created_by)
VALUES (gen_random_uuid(), tests.get('b_household_id'), tests.get('b_profile_id'), 'Cuenta de B', 'checking', 'ARS', tests.get('b_profile_id'));

SELECT tests.authenticate_as(tests.get('a_profile_id'));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.accounts WHERE household_id = tests.get('b_household_id')),
  0,
  'A no puede leer cuentas de B'
));

SELECT tests.log(throws_ok(
  format(
    $$INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, created_by)
      VALUES (gen_random_uuid(), %L, %L, 'Cuenta intrusa', 'checking', 'ARS', %L)$$,
    tests.get('b_household_id'), tests.get('a_profile_id'), tests.get('a_profile_id')
  ),
  'new row violates row-level security policy for table "accounts"',
  'A no puede insertar una cuenta en el household de B'
));

SELECT tests.log(is(
  public.can_write(tests.get('b_household_id')),
  false,
  'A no tiene can_write() sobre el household de B'
));

-- vuelvo a modo fixture (bypassea RLS) para crear una cuenta propia de A
SELECT tests.clear_authentication();
SELECT tests.stash('a_account_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, created_by)
VALUES (tests.get('a_account_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'Cuenta de A', 'checking', 'ARS', tests.get('a_profile_id'));

SELECT tests.authenticate_as(tests.get('a_profile_id'));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.accounts WHERE id = tests.get('a_account_id')),
  1,
  'A sí puede leer su propia cuenta'
));

-- intento mover la cuenta de A al household de B (household_id es
-- inmutable, ver docs/plan-de-trabajo.md § 5.1 nota de endurecimiento). Un
-- WITH CHECK que falla en UPDATE lanza una excepción dura (a diferencia de
-- USING, que solo filtra filas en silencio) — verificado empíricamente
-- contra el proyecto real, se prueba con throws_ok, no esperando un no-op.
SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.accounts SET household_id = %L WHERE id = %L$$,
    tests.get('b_household_id'), tests.get('a_account_id')
  ),
  'new row violates row-level security policy for table "accounts"',
  'el UPDATE que intenta mover la cuenta a household B es rechazado por WITH CHECK'
));

SELECT tests.log(is(
  (SELECT household_id FROM public.accounts WHERE id = tests.get('a_account_id')),
  tests.get('a_household_id'),
  'la cuenta de A sigue en household A después del intento fallido'
));

-- intento de UPDATE directo sobre una fila de B (ni siquiera visible, RLS
-- la filtra antes de llegar al WITH CHECK: 0 filas afectadas, sin error)
UPDATE public.accounts SET name = 'hackeado' WHERE household_id = tests.get('b_household_id');

SELECT tests.clear_authentication();
SELECT tests.log(isnt(
  (SELECT name FROM public.accounts WHERE household_id = tests.get('b_household_id') LIMIT 1),
  'hackeado',
  'A no pudo actualizar el nombre de una cuenta de B'
));

-- DELETE nunca se expone: no hay policy de DELETE, un intento no debe borrar nada
SELECT tests.authenticate_as(tests.get('a_profile_id'));
DELETE FROM public.accounts WHERE household_id = tests.get('b_household_id');
SELECT tests.clear_authentication();
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.accounts WHERE household_id = tests.get('b_household_id')),
  1,
  'el DELETE de A sobre una cuenta de B no borró nada (no hay policy de DELETE)'
));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.accounts WHERE household_id = tests.get('a_household_id')),
  1,
  'la cuenta de A sigue existiendo, sin tocar'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
