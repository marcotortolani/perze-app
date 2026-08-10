-- Paso 5 del resumen por mail: `household_period_start()`,
-- `summary_emails_sent` y su RLS (`20260810190000_monthly_summary_schedule.sql`).
--
-- `household_period_start()` es la regla del período del hogar escrita en
-- SQL: espejo de `periodStart()` (`src/lib/analytics/history.ts`). De ella
-- salen las tres fechas que el cron le pasa a la Edge Function, así que si
-- devuelve un mes corrido el mail entero habla de otro período que el que
-- muestra la app.
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(12));

-- El período del hogar --------------------------------------------------
SELECT tests.log(is(
  public.household_period_start(1::smallint, '2026-07-15'::date),
  '2026-07-01'::date,
  'cierre el 1: a mitad de julio el período arrancó el 1 de julio'
));

SELECT tests.log(is(
  public.household_period_start(1::smallint, '2026-07-01'::date),
  '2026-07-01'::date,
  'el día del cierre YA es el primer día del período nuevo, no el último del viejo'
));

SELECT tests.log(is(
  public.household_period_start(10::smallint, '2026-07-05'::date),
  '2026-06-10'::date,
  'cierre el 10: antes del 10 todavía corre el período que arrancó el mes pasado'
));

SELECT tests.log(is(
  public.household_period_start(10::smallint, '2026-07-31'::date),
  '2026-07-10'::date,
  'cierre el 10: pasado el 10, el período arrancó este mes'
));

SELECT tests.log(is(
  public.household_period_start(10::smallint, '2026-01-05'::date),
  '2025-12-10'::date,
  'el retroceso cruza el año sin perderse'
));

-- La UI ofrece del 1 al 28, así que este caso no se puede producir hoy; el
-- clamp existe para que ampliar esa lista no empiece a devolver fechas del
-- mes siguiente en silencio.
SELECT tests.log(is(
  public.household_period_start(31::smallint, '2026-02-15'::date),
  '2026-01-31'::date,
  'un día de cierre mayor al último del mes se clampea, no se desborda al mes siguiente'
));

-- Idempotencia y visibilidad --------------------------------------------
SELECT tests.clear_authentication();
SELECT tests.setup_household('a', 'msch-household-a');
SELECT tests.setup_household('b', 'msch-household-b');

INSERT INTO public.household_members (household_id, profile_id, role, status, joined_at)
VALUES (tests.get('a_household_id'), tests.get('b_profile_id'), 'member', 'active', now());

INSERT INTO public.summary_emails_sent (household_id, profile_id, kind, period_start, period_end)
VALUES (tests.get('a_household_id'), tests.get('a_profile_id'), 'monthly', '2026-07-01', '2026-07-31');

SELECT tests.log(throws_ok(
  format(
    $$INSERT INTO public.summary_emails_sent (household_id, profile_id, kind, period_start, period_end)
      VALUES (%L, %L, 'monthly', '2026-07-01', '2026-07-31')$$,
    tests.get('a_household_id'), tests.get('a_profile_id')
  ),
  '23505'::char(5),
  NULL::text,
  'el mismo resumen no se puede registrar dos veces — es lo que impide el mail duplicado'
));

INSERT INTO public.summary_emails_sent (household_id, profile_id, kind, period_start, period_end)
VALUES (tests.get('a_household_id'), tests.get('a_profile_id'), 'annual', '2026-01-01', '2026-12-31');
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.summary_emails_sent WHERE household_id = tests.get('a_household_id')),
  2,
  'el anual del mismo hogar convive con el mensual: la clave incluye kind'
));

INSERT INTO public.summary_emails_sent (household_id, profile_id, kind, period_start, period_end)
VALUES (tests.get('a_household_id'), tests.get('b_profile_id'), 'monthly', '2026-07-01', '2026-07-31');

SELECT tests.authenticate_as(tests.get('a_profile_id'));

SELECT tests.log(is(
  (SELECT count(*)::int FROM public.summary_emails_sent),
  2,
  'cada miembro lee sus propios registros, no los del resto del hogar'
));

SELECT tests.log(throws_ok(
  format(
    $$INSERT INTO public.summary_emails_sent (household_id, profile_id, kind, period_start, period_end)
      VALUES (%L, %L, 'monthly', '2026-08-01', '2026-08-31')$$,
    tests.get('a_household_id'), tests.get('a_profile_id')
  ),
  '42501'::char(5),
  NULL::text,
  'nadie desde el cliente marca un resumen como enviado — solo la Edge Function con service_role'
));

SELECT tests.log(throws_ok(
  $$DELETE FROM public.summary_emails_sent$$,
  '42501'::char(5),
  NULL::text,
  'ni lo borra para forzar un reenvío'
));

SELECT tests.clear_authentication();

-- La preferencia ---------------------------------------------------------
INSERT INTO public.notification_preferences (id, household_id, profile_id)
VALUES (gen_random_uuid(), tests.get('a_household_id'), tests.get('a_profile_id'));

SELECT tests.log(is(
  (SELECT monthly_summary_email FROM public.notification_preferences WHERE profile_id = tests.get('a_profile_id')),
  true,
  'la preferencia nace encendida: quien no la tocó recibe su resumen'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
