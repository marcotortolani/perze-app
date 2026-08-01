-- GATE-1: fx_overrides (paso 1 de la cadena de resolución de FX), tags,
-- payees. Las tres son raíz simples (Patrón A) sin visibilidad especial.
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(9));

SELECT tests.clear_authentication();
SELECT tests.setup_household('a', 'fx-household-a');
SELECT tests.setup_household('b', 'fx-household-b');

SELECT tests.stash('b_override_id', gen_random_uuid());
INSERT INTO public.fx_overrides (id, household_id, base_currency, quote_currency, rate, valid_from, created_by)
VALUES (tests.get('b_override_id'), tests.get('b_household_id'), 'USD', 'ARS', 1000, current_date, tests.get('b_profile_id'));

SELECT tests.stash('a_override_id', gen_random_uuid());
INSERT INTO public.fx_overrides (id, household_id, base_currency, quote_currency, rate, valid_from, created_by)
VALUES (tests.get('a_override_id'), tests.get('a_household_id'), 'USD', 'ARS', 950, current_date, tests.get('a_profile_id'));

SELECT tests.stash('a_tag_id', gen_random_uuid());
INSERT INTO public.tags (id, household_id, name)
VALUES (tests.get('a_tag_id'), tests.get('a_household_id'), 'viaje');

SELECT tests.stash('a_payee_id', gen_random_uuid());
INSERT INTO public.payees (id, household_id, name)
VALUES (tests.get('a_payee_id'), tests.get('a_household_id'), 'Uber');

SELECT tests.authenticate_as(tests.get('a_profile_id'));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.fx_overrides WHERE household_id = tests.get('b_household_id')),
  0,
  'A no puede leer overrides de FX de B'
));

SELECT tests.log(throws_ok(
  format(
    $$INSERT INTO public.fx_overrides (id, household_id, base_currency, quote_currency, rate, valid_from, created_by)
      VALUES (gen_random_uuid(), %L, 'USD', 'ARS', 1, current_date, %L)$$,
    tests.get('b_household_id'), tests.get('a_profile_id')
  ),
  'new row violates row-level security policy for table "fx_overrides"',
  'A no puede insertar un override de FX en el household de B'
));

SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.fx_overrides SET household_id = %L WHERE id = %L$$,
    tests.get('b_household_id'), tests.get('a_override_id')
  ),
  'new row violates row-level security policy for table "fx_overrides"',
  'A no puede mover su override de FX al household de B'
));

-- cerrar la vigencia (valid_to) es la única escritura legítima después de
-- crear un override — debe funcionar
UPDATE public.fx_overrides SET valid_to = current_date WHERE id = tests.get('a_override_id');
SELECT tests.log(isnt(
  (SELECT valid_to FROM public.fx_overrides WHERE id = tests.get('a_override_id')),
  NULL,
  'A puede cerrar la vigencia de su propio override (UPDATE valid_to)'
));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.tags WHERE household_id = tests.get('b_household_id')),
  0,
  'A no puede leer tags de B'
));

SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.tags SET household_id = %L WHERE id = %L$$,
    tests.get('b_household_id'), tests.get('a_tag_id')
  ),
  'new row violates row-level security policy for table "tags"',
  'A no puede mover su tag al household de B'
));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.payees WHERE household_id = tests.get('b_household_id')),
  0,
  'A no puede leer payees de B'
));

SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.payees SET household_id = %L WHERE id = %L$$,
    tests.get('b_household_id'), tests.get('a_payee_id')
  ),
  'new row violates row-level security policy for table "payees"',
  'A no puede mover su payee al household de B'
));

SELECT tests.log(is(
  public.can_write(tests.get('b_household_id')),
  false,
  'sanity check final: A no tiene can_write() sobre el household de B'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
