-- recurring_occurrences_between — espejo SQL de src/lib/recurring/occurrences.ts.
-- Los casos acá son un subconjunto a mano de
-- src/lib/recurring/__fixtures__/occurrence-vectors.json (mismos nombres,
-- mismos valores) — no hay generador automático todavía; si se agrega un
-- vector nuevo del lado TS, replicarlo acá a mano hasta que exista uno.
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(7));

SELECT tests.log(is(
  ARRAY(SELECT * FROM public.recurring_occurrences_between('monthly', '2026-01-31', 31, '2026-01-01', '2026-04-30')),
  ARRAY['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']::date[],
  'monthly-day31-clamp'
));

SELECT tests.log(is(
  ARRAY(SELECT * FROM public.recurring_occurrences_between('yearly', '2028-02-29', 29, '2028-01-01', '2031-12-31')),
  ARRAY['2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28']::date[],
  'yearly-feb29-leap'
));

SELECT tests.log(is(
  ARRAY(SELECT * FROM public.recurring_occurrences_between('biweekly', '2025-12-25', NULL, '2026-01-01', '2026-01-31')),
  ARRAY['2026-01-08', '2026-01-22']::date[],
  'biweekly-cross-year'
));

SELECT tests.log(is(
  ARRAY(SELECT * FROM public.recurring_occurrences_between('weekly', '2026-10-01', NULL, '2026-10-15', '2026-11-05')),
  ARRAY['2026-10-15', '2026-10-22', '2026-10-29', '2026-11-05']::date[],
  'weekly-dst-cross-madrid'
));

SELECT tests.log(is(
  ARRAY(SELECT * FROM public.recurring_occurrences_between('monthly', '2027-01-01', 1, '2026-01-01', '2026-12-31')),
  ARRAY[]::date[],
  'anchor-in-future'
));

SELECT tests.log(is(
  ARRAY(SELECT * FROM public.recurring_occurrences_between('monthly', '2026-01-01', 1, '2026-06-01', '2026-01-01')),
  ARRAY[]::date[],
  'from-after-to'
));

-- `end_date` no es parámetro de la función — lo aplica el caller acotando
-- `p_to`, igual que hace TS en `occurrencesBetween` (`cappedTo`).
SELECT tests.log(is(
  ARRAY(SELECT * FROM public.recurring_occurrences_between('monthly', '2026-01-15', 15, '2026-01-01', LEAST('2026-03-15'::date, '2026-12-31'::date))),
  ARRAY['2026-01-15', '2026-02-15', '2026-03-15']::date[],
  'end-date-truncation'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
