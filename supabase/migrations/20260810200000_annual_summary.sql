-- Resumen anual (`docs/resumen-mensual-por-mail.md`). Es el mismo resumen
-- sobre doce períodos: reusa `summary_transactions()`,
-- `summary_account_balances()`, `summary_emails_sent` (su `CHECK` ya
-- aceptaba `'annual'`) y la misma preferencia. Lo único propio son los
-- cortes de los doce períodos y cuándo se dispara.

-- Los cortes del rango: doce períodos son TRECE fechas, porque el fin del
-- último también es un corte. De acá sale el "mes de mayor gasto" del
-- anual, y por eso salen de la regla del hogar y no de meses calendario:
-- el período de alguien que cierra el 10 no es "julio".
--
-- El `generate_series` llega a 24 para cubrir cualquier rango de hasta dos
-- años; el `WHERE` recorta. Es un tope duro a propósito: una función que
-- genera una fila por mes sin límite es un pie de bala esperando un rango
-- mal armado.
CREATE FUNCTION public.household_period_cuts(p_start_day smallint, p_from date, p_to date)
RETURNS SETOF date
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT c FROM (
    SELECT (
      date_trunc('month', p_from + (i * interval '1 month'))::date
      + (least(
           greatest(p_start_day, 1),
           extract(day FROM (date_trunc('month', p_from + (i * interval '1 month')) + interval '1 month - 1 day'))::int
         ) - 1)
    ) AS c
    FROM generate_series(0, 24) AS i
  ) s
  WHERE c >= p_from AND c <= p_to
  ORDER BY c;
$$;

REVOKE EXECUTE ON FUNCTION public.household_period_cuts(smallint, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.household_period_cuts(smallint, date, date) TO authenticated, service_role;

-- El disparo del anual.
--
-- **Sale una semana después del mensual de diciembre, no el mismo día.**
-- El cierre del primer período del año dispara los dos, y dos mails de
-- resumen el mismo día compiten entre sí: el anual, que es el interesante,
-- se lee por arriba. La ventana de reintento es la misma de siempre.
--
-- El "año" de un hogar son sus doce períodos, no el calendario: para quien
-- cierra el 10, va del 10 de enero al 10 de enero. La fecha sonda es el 28
-- porque la UI ofrece días de cierre del 1 al 28 (`CLOSE_DAYS`), así que
-- `household_period_start(day, <28 de enero>)` siempre cae en enero de ese
-- mismo año.
CREATE FUNCTION public.trigger_annual_summaries()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_url text;
  v_service_key text;
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_year int := extract(year FROM (now() AT TIME ZONE 'UTC'))::int;
  v_household record;
  v_year_start date;
  v_year_end date;
  v_previous_start date;
  v_first_tx timestamptz;
BEGIN
  SELECT decrypted_secret INTO v_project_url FROM vault.decrypted_secrets WHERE name = 'perze_project_url';
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'perze_service_role_key';
  IF v_project_url IS NULL OR v_service_key IS NULL THEN
    RETURN;
  END IF;

  FOR v_household IN
    SELECT h.id, h.period_start_day FROM public.households h WHERE h.deleted_at IS NULL
  LOOP
    v_year_start := public.household_period_start(v_household.period_start_day, make_date(v_year - 1, 1, 28));
    v_year_end := public.household_period_start(v_household.period_start_day, make_date(v_year, 1, 28));

    CONTINUE WHEN (v_today - (v_year_end + 7)) NOT BETWEEN 0 AND 3;

    -- Mínimo de historial: con menos de tres períodos, un "resumen del año"
    -- promete algo que no tiene (`CLAUDE.md` § Mínimos de historial). El
    -- hogar lo recibe el año que viene. Se mira el primer movimiento del
    -- hogar y no los de cada miembro: es una pregunta sobre si hay
    -- historia, no sobre qué ve cada uno — eso lo sigue resolviendo la
    -- consulta por miembro, que devuelve "sin actividad" si corresponde.
    SELECT min(t.occurred_at) INTO v_first_tx
    FROM public.transactions t
    WHERE t.household_id = v_household.id AND t.deleted_at IS NULL AND t.occurred_at < v_year_end;

    CONTINUE WHEN v_first_tx IS NULL OR v_first_tx > (v_year_end - interval '3 months');

    v_previous_start := public.household_period_start(v_household.period_start_day, make_date(v_year - 2, 1, 28));

    PERFORM net.http_post(
      url := v_project_url || '/functions/v1/monthly-summary',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'kind', 'annual',
        'householdId', v_household.id,
        'periodStart', v_year_start,
        'periodEnd', v_year_end - 1,
        'previousPeriodStart', v_previous_start
      )
    );
  END LOOP;
END;
$$;

-- Misma hora que el mensual: el desplazamiento son los 7 días de arriba,
-- no un horario distinto. Corre todos los días y casi siempre no hace nada
-- — recorrer los hogares y descartar por fecha es barato.
SELECT cron.schedule('perze-annual-summaries', '0 12 * * *', 'SELECT public.trigger_annual_summaries();');
