-- Paso 5 de `docs/resumen-mensual-por-mail.md`: preferencia, idempotencia y
-- cron. Lo de arriba (lectura, cálculo, plantilla, envío) ya funciona;
-- esto decide QUIÉN recibe y CUÁNDO, que es lo único que faltaba.

-- 1. Preferencia -------------------------------------------------------
-- Encendida por defecto: quien no la tocó nunca recibe un resumen por mes,
-- que es el contrato de la funcionalidad. Apagarla es un tap.
ALTER TABLE public.notification_preferences
  ADD COLUMN monthly_summary_email boolean NOT NULL DEFAULT true;

-- `weekly_summary` queda como columna muerta: las migraciones son
-- append-only y hay filas que la traen en true por default. No la lee ni
-- la escribe nada — nunca hubo un envío semanal, ni push ni mail — y su
-- toggle sale de `/more/notifications` en el mismo movimiento. Se deja
-- documentada acá para que nadie la "reactive" pensando que se rompió.
COMMENT ON COLUMN public.notification_preferences.weekly_summary IS
  'MUERTA. Nunca hubo envío semanal; la reemplaza monthly_summary_email. No leer.';

-- 2. Idempotencia ------------------------------------------------------
-- El cron reintenta durante unos días para poder recuperarse de un fallo
-- de red, así que sin esto un hogar recibiría el mismo resumen tres veces.
-- El `UNIQUE` es la garantía real: chequear antes de mandar no alcanza,
-- porque entre el chequeo y el envío hay una carrera.
CREATE TABLE public.summary_emails_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), -- server-only: no hay id del cliente que respetar
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('monthly', 'annual')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, profile_id, kind, period_start)
);

ALTER TABLE public.summary_emails_sent ENABLE ROW LEVEL SECURITY;

-- Solo lectura de lo propio: sirve para que la app pueda decir "tu último
-- resumen salió el 3 de agosto" sin exponer los de los demás miembros.
CREATE POLICY summary_emails_sent_select ON public.summary_emails_sent FOR SELECT
USING (profile_id = (SELECT auth.uid()));

-- Sin políticas de escritura a propósito: la única que escribe es la Edge
-- Function con `service_role`, que no pasa por RLS. El REVOKE es cinturón
-- además de tirantes — con RLS encendida y sin política de INSERT ya
-- estaría denegado, pero un futuro `FOR ALL` distraído no debería alcanzar
-- para que un cliente marque un resumen como enviado y se quede sin él.
REVOKE INSERT, UPDATE, DELETE ON public.summary_emails_sent FROM anon, authenticated;

-- 3. El período del hogar en SQL ---------------------------------------
-- Espejo de `periodStart()` (`src/lib/analytics/history.ts`): el inicio del
-- período que CONTIENE la fecha dada. El día de cierre se configura por
-- household y no todos cierran el 1 (`CLAUDE.md`).
--
-- El `least()` clampea el día al último del mes. La UI ofrece del 1 al 28
-- (`CLOSE_DAYS` en `/more/settings`), así que el caso "31 en febrero" no se
-- puede producir hoy; el clamp está para que el día que esa lista se
-- amplíe, esto no empiece a devolver fechas del mes siguiente en silencio.
CREATE FUNCTION public.household_period_start(p_start_day smallint, p_on date)
RETURNS date
LANGUAGE plpgsql IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_month_start date;
  v_start date;
BEGIN
  v_month_start := date_trunc('month', p_on)::date;
  v_start := v_month_start + (least(greatest(p_start_day, 1), extract(day FROM (v_month_start + interval '1 month - 1 day'))::int) - 1);

  IF p_on < v_start THEN
    v_month_start := date_trunc('month', p_on - interval '1 month')::date;
    v_start := v_month_start + (least(greatest(p_start_day, 1), extract(day FROM (v_month_start + interval '1 month - 1 day'))::int) - 1);
  END IF;

  RETURN v_start;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.household_period_start(smallint, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.household_period_start(smallint, date) TO authenticated, service_role;

-- 4. El cron -----------------------------------------------------------
-- Mismo patrón que `trigger_daily_fx_sync` / `trigger_daily_inflation_sync`
-- (`20260801160000_cron_engines.sql`): `pg_net` contra la Edge Function,
-- salida en silencio si los secrets de Vault no están registrados.
--
-- Corre todos los días y despacha solo los hogares cuyo período cerró
-- dentro de la ventana de reintento. NO decide qué miembro recibe: eso lo
-- resuelve la Edge Function, que es la que puede consultar la preferencia,
-- reclamar el envío en `summary_emails_sent` y saber si salió bien. Acá no
-- se sabe si el mail llegó — `net.http_post` es fire-and-forget.
CREATE FUNCTION public.trigger_monthly_summaries()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_url text;
  v_service_key text;
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_household record;
  v_current_start date;
  v_period_start date;
  v_previous_start date;
BEGIN
  SELECT decrypted_secret INTO v_project_url FROM vault.decrypted_secrets WHERE name = 'perze_project_url';
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'perze_service_role_key';
  IF v_project_url IS NULL OR v_service_key IS NULL THEN
    RETURN;
  END IF;

  FOR v_household IN
    SELECT h.id, h.period_start_day FROM public.households h WHERE h.deleted_at IS NULL
  LOOP
    v_current_start := public.household_period_start(v_household.period_start_day, v_today);

    -- Ventana de reintento: el día del cierre y los tres siguientes. Sin
    -- ella, un fallo de red el día del cierre deja a ese hogar sin resumen
    -- hasta el mes que viene, porque el disparador no se repite. Los
    -- reintentos son inofensivos: el `UNIQUE` de arriba los convierte en
    -- no-ops para quien ya lo recibió.
    CONTINUE WHEN v_today - v_current_start > 3;

    -- El período que cerró es el anterior al que está corriendo, y su
    -- último día es el previo al inicio del actual.
    v_period_start := public.household_period_start(v_household.period_start_day, v_current_start - 1);
    v_previous_start := public.household_period_start(v_household.period_start_day, v_period_start - 1);

    PERFORM net.http_post(
      url := v_project_url || '/functions/v1/monthly-summary',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'householdId', v_household.id,
        'periodStart', v_period_start,
        'periodEnd', v_current_start - 1,
        'previousPeriodStart', v_previous_start
      )
    );
  END LOOP;
END;
$$;

-- 12:00 UTC — 9 de la mañana en Uruguay/Argentina, mediodía en España.
-- Un resumen del mes se lee de mañana, no de madrugada, y a esa hora el
-- cierre del día anterior ya sincronizó de cualquier dispositivo.
SELECT cron.schedule('perze-monthly-summaries', '0 12 * * *', 'SELECT public.trigger_monthly_summaries();');
