-- `household_period_cuts()` (`20260810200000_annual_summary.sql`), de donde
-- sale el "mes de mayor gasto" del resumen anual.
--
-- Son los cortes REALES del hogar, no meses calendario: el período de
-- alguien que cierra el 10 no es "julio", y agrupar por mes calendario
-- pondría dos medias mitades adentro del mismo bucket.
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(6));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.household_period_cuts(1::smallint, '2026-01-01'::date, '2026-12-31'::date)),
  12,
  'un año de cierre el 1 tiene 12 cortes dentro del rango'
));

SELECT tests.log(is(
  (SELECT min(c) FROM public.household_period_cuts(1::smallint, '2026-01-01'::date, '2026-12-31'::date) AS c),
  '2026-01-01'::date,
  'el primer corte es el inicio del rango'
));

SELECT tests.log(is(
  (SELECT max(c) FROM public.household_period_cuts(1::smallint, '2026-01-01'::date, '2026-12-31'::date) AS c),
  '2026-12-01'::date,
  'el último corte adentro del rango es el inicio del último período'
));

-- Cierre el 10: el año del hogar va del 10 de enero al 10 de enero.
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.household_period_cuts(10::smallint, '2026-01-10'::date, '2027-01-09'::date)),
  12,
  'cierre el 10: también son 12 períodos, corridos respecto del calendario'
));

SELECT tests.log(is(
  (SELECT array_agg(c ORDER BY c)[2] FROM public.household_period_cuts(10::smallint, '2026-01-10'::date, '2027-01-09'::date) AS c),
  '2026-02-10'::date,
  'el segundo corte respeta el día de cierre, no el 1 del mes'
));

-- Febrero no tiene 30: el corte se clampea al último día, igual que
-- `household_period_start()`.
SELECT tests.log(is(
  (SELECT array_agg(c ORDER BY c)[2] FROM public.household_period_cuts(28::smallint, '2026-01-28'::date, '2026-04-30'::date) AS c),
  '2026-02-28'::date,
  'un día de cierre que no existe en el mes se clampea al último'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
