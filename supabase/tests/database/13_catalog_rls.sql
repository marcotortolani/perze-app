-- GATE-1 + § 3 Patrón C: institutions/instruments/asset_classes tienen
-- filas globales (household_id IS NULL) legibles por cualquier autenticado
-- pero nunca escribibles desde el cliente, y filas propias del household
-- que sí se pueden escribir. currencies/countries/fx_rates son Patrón C
-- puro: ni siquiera el household puede escribir.
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(5));

SELECT tests.clear_authentication();
SELECT tests.setup_household('a', 'catalog-household-a');
SELECT tests.setup_household('b', 'catalog-household-b');

SELECT tests.stash('global_inst_id', gen_random_uuid());
INSERT INTO public.institutions (id, household_id, name, country_code, kind, color)
VALUES (tests.get('global_inst_id'), NULL, 'Banco Global (seed)', NULL, 'bank', '#123456');

SELECT tests.authenticate_as(tests.get('a_profile_id'));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.institutions WHERE id = tests.get('global_inst_id')),
  1,
  'una institución global (household_id NULL) es legible por cualquier autenticado'
));

-- Un UPDATE contra una fila que la policy USING filtra no lanza error, solo
-- afecta 0 filas — se verifica el efecto, no una excepción.
UPDATE public.institutions SET name = 'hackeado' WHERE id = tests.get('global_inst_id');

SELECT tests.clear_authentication();
SELECT tests.log(isnt(
  (SELECT name FROM public.institutions WHERE id = tests.get('global_inst_id')),
  'hackeado',
  'nadie puede mutar una fila global de institutions desde el cliente (institutions_write exige household_id IS NOT NULL)'
));

-- clonado (copy-on-write): A crea su propia institución con source_id
-- apuntando a la global, sin tocar la global
SELECT tests.authenticate_as(tests.get('a_profile_id'));
SELECT tests.stash('a_clone_id', gen_random_uuid());
INSERT INTO public.institutions (id, household_id, name, country_code, kind, color, source_id)
VALUES (tests.get('a_clone_id'), tests.get('a_household_id'), 'Banco Global (mi copia)', NULL, 'bank', '#123456', tests.get('global_inst_id'));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.institutions WHERE household_id = tests.get('a_household_id') AND source_id = tests.get('global_inst_id')),
  1,
  'A puede clonar la institución global a su propio household con source_id'
));

-- bug encontrado y corregido en 20260801020300: institutions_write no
-- fijaba household_id como inmutable — un miembro de dos households podía
-- mover su clon de uno a otro. La protección real es el trigger
-- `institutions_immutable` (A5, `20260801130000_immutability_triggers.sql`)
-- — el WITH CHECK de la policy seguía siendo tautológico.
SELECT tests.log(throws_ok(
  format(
    $$UPDATE public.institutions SET household_id = %L WHERE id = %L$$,
    tests.get('b_household_id'), tests.get('a_clone_id')
  ),
  'La columna household_id es inmutable en institutions',
  'A no puede mover su clon de institución al household de B (household_id inmutable)'
));

-- currencies es Patrón C puro: ni el household puede insertar una moneda nueva
SELECT tests.log(throws_ok(
  $$INSERT INTO public.currencies (code, name, symbol, decimals, kind) VALUES ('XXX', 'Falsa', 'X', 2, 'fiat')$$,
  'new row violates row-level security policy for table "currencies"',
  'ningún usuario autenticado puede insertar en currencies (Patrón C puro, solo seeds/cron)'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
