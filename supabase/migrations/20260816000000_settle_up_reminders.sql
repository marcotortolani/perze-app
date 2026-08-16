-- Fase 4 auditoría — recordatorio de settle-up: hoy saldar entre miembros
-- del household (`src/lib/analytics/settle-up.ts`) es 100% manual, así que
-- depende de que alguien se acuerde de abrir Familia. Mismo patrón de cron
-- que `dispatch_due_notifications()`/`card_statement_due`
-- (`20260803000000_card_settlement.sql`): un `pg_cron` + `pg_net` que llama
-- directo a `send-push` con el texto ya armado, idempotencia por
-- `audit_log`. A diferencia de `monthly-summary` (que sí necesita el mismo
-- TypeScript que las pantallas para no duplicar la agregación), acá el
-- monto que se manda es `share_amount_base` — YA resuelto y congelado por
-- fila — así que sumar `bigint` en SQL es una operación segura, sin
-- reinventar ninguna regla de negocio: es la misma condición de
-- `computeNetBalances` (J7) — needs_fx (`share_amount_base IS NULL`) se
-- excluye siempre, nunca se cuenta como 0.

-- 1. Preferencia ---------------------------------------------------------
ALTER TABLE public.notification_preferences
  ADD COLUMN settle_up_reminders boolean NOT NULL DEFAULT true;

-- 2. El cron --------------------------------------------------------------
-- Corre al cierre de cada household (mismo criterio de ventana de
-- reintento que `trigger_monthly_summaries`: el día del cierre y los tres
-- siguientes), y solo en hogares con el módulo `family` prendido — sin
-- household compartido no hay "quién le debe a quién" que recordar.
CREATE FUNCTION public.trigger_settle_up_reminders()
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
  v_pair record;
  v_debtor uuid;
  v_creditor uuid;
  v_amount bigint;
  v_debtor_name text;
  v_creditor_name text;
  v_decimals smallint;
  v_amount_text text;
BEGIN
  SELECT decrypted_secret INTO v_project_url FROM vault.decrypted_secrets WHERE name = 'perze_project_url';
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'perze_service_role_key';
  IF v_project_url IS NULL OR v_service_key IS NULL THEN
    RETURN;
  END IF;

  FOR v_household IN
    SELECT h.id, h.period_start_day, h.base_currency
    FROM public.households h
    WHERE h.deleted_at IS NULL AND 'family' = ANY(h.enabled_modules)
  LOOP
    v_current_start := public.household_period_start(v_household.period_start_day, v_today);
    CONTINUE WHEN v_today - v_current_start > 3;
    v_period_start := public.household_period_start(v_household.period_start_day, v_current_start - 1);
    v_decimals := public.currency_decimals(v_household.base_currency);

    -- Neto por par de miembros, needs_fx excluido — mismo criterio que
    -- `computeNetBalances`: un share sin `share_amount_base` resuelto
    -- nunca se suma como si valiera 0, y el share del propio pagador
    -- (`member_id = paid_by`) no es una deuda.
    --
    -- `net_b_owes_a`: positivo = el miembro "mayor" (member_b, por id) le
    -- debe al "menor" (member_a); negativo = al revés. Cada fila de
    -- `transaction_shares` dice "member_id le debe a paid_by
    -- (transactions.created_by) share_amount_base" — se pliega a la
    -- convención member_a < member_b para poder agrupar el par sin
    -- importar en qué orden quedó cada movimiento individual.
    FOR v_pair IN
      SELECT
        LEAST(s.member_id, t.created_by) AS member_a,
        GREATEST(s.member_id, t.created_by) AS member_b,
        SUM(CASE WHEN s.member_id = GREATEST(s.member_id, t.created_by) THEN s.share_amount_base ELSE -s.share_amount_base END) AS net_b_owes_a
      FROM public.transaction_shares s
      JOIN public.transactions t ON t.id = s.transaction_id
      WHERE t.household_id = v_household.id
        AND t.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND s.settled_at IS NULL
        AND s.share_amount_base IS NOT NULL
        AND s.member_id <> t.created_by
      GROUP BY 1, 2
      HAVING SUM(CASE WHEN s.member_id = GREATEST(s.member_id, t.created_by) THEN s.share_amount_base ELSE -s.share_amount_base END) <> 0
    LOOP
      -- Idempotencia: un solo recordatorio por par y período — el cron
      -- reintenta los tres días siguientes al cierre, y sin esto cada
      -- reintento mandaría el mismo push de vuelta.
      IF EXISTS (
        SELECT 1 FROM public.audit_log a
        WHERE a.household_id = v_household.id AND a.entity = 'notification' AND a.action = 'settle_up_reminder'
          AND (a.diff ->> 'period_start') = v_period_start::text
          AND (a.diff ->> 'member_a') = v_pair.member_a::text
          AND (a.diff ->> 'member_b') = v_pair.member_b::text
      ) THEN
        CONTINUE;
      END IF;

      IF v_pair.net_b_owes_a > 0 THEN
        v_debtor := v_pair.member_b;
        v_creditor := v_pair.member_a;
        v_amount := v_pair.net_b_owes_a;
      ELSE
        v_debtor := v_pair.member_a;
        v_creditor := v_pair.member_b;
        v_amount := -v_pair.net_b_owes_a;
      END IF;

      SELECT display_name INTO v_debtor_name FROM public.profiles WHERE id = v_debtor;
      SELECT display_name INTO v_creditor_name FROM public.profiles WHERE id = v_creditor;
      -- Formateo simple, sin separador de miles ni preferencia de
      -- decimales del usuario (`Ajustes → Formato`) — mismo criterio que
      -- ya usa `card_statement_due` unas migraciones más arriba para la
      -- fecha (`to_char(..., 'DD/MM')` fijo): el cuerpo de un push es
      -- texto de servidor, no un componente de UI, y no hay perfil de
      -- lectura ahí para elegirle el formato. Documentado como límite
      -- conocido, no un olvido.
      v_amount_text := round(v_amount::numeric / power(10, v_decimals), v_decimals)::text;

      PERFORM net.http_post(
        url := v_project_url || '/functions/v1/send-push',
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key, 'Content-Type', 'application/json'),
        body := jsonb_build_object(
          'householdId', v_household.id,
          'profileIds', jsonb_build_array(v_debtor),
          'kind', 'settle_up_reminder',
          'title', 'Recordatorio de saldo',
          'body', 'Llevás ' || v_household.base_currency || ' ' || v_amount_text || ' pendiente con ' || COALESCE(v_creditor_name, 'un miembro del hogar'),
          'url', '/family/settle'
        )
      );
      PERFORM net.http_post(
        url := v_project_url || '/functions/v1/send-push',
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key, 'Content-Type', 'application/json'),
        body := jsonb_build_object(
          'householdId', v_household.id,
          'profileIds', jsonb_build_array(v_creditor),
          'kind', 'settle_up_reminder',
          'title', 'Recordatorio de saldo',
          'body', COALESCE(v_debtor_name, 'Un miembro del hogar') || ' te debe ' || v_household.base_currency || ' ' || v_amount_text,
          'url', '/family/settle'
        )
      );

      INSERT INTO public.audit_log (household_id, entity, entity_id, action, diff)
      VALUES (v_household.id, 'notification', v_household.id, 'settle_up_reminder',
        jsonb_build_object('period_start', v_period_start, 'member_a', v_pair.member_a, 'member_b', v_pair.member_b));
    END LOOP;
  END LOOP;
END;
$$;

-- 13:00 UTC — una hora después del resumen mensual (12:00 UTC,
-- `20260810190000_monthly_summary_schedule.sql`), mismo motivo: de mañana
-- en Uruguay/Argentina/España, no de madrugada.
SELECT cron.schedule('perze-settle-up-reminders', '0 13 * * *', 'SELECT public.trigger_settle_up_reminders();');
