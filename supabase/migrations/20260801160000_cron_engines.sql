-- F6 — motores faltantes (E9 a–f, E14, E20 de docs/plan-resolucion-auditoria-tecnica.md).
-- Hasta acá el schema tenía la forma pero nada la accionaba: `fx_rates`
-- vacía para siempre, ninguna recurrente se materializaba sola,
-- `send-push` documentaba textualmente "esta función NO se llama sola",
-- `card_statements` nunca pasaba a `overdue`, y `push_subscriptions`/
-- `audit_log` crecían sin límite. Esta migración prende `pg_cron`+`pg_net`
-- y agrega las funciones que esos cron jobs llaman.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Meses más cortos que `day`: cae al último día real de ese mes (mismo
-- criterio que el cliente resuelve para `recurring_rules.day_of_month` —
-- ver el comentario de esa columna). Evita que `make_date` reviente con un
-- "31 de febrero" al armar el período de un household o de una regla.
CREATE FUNCTION public.clamped_date(p_year int, p_month int, p_day int)
RETURNS date
LANGUAGE sql IMMUTABLE
AS $$
  SELECT LEAST(
    make_date(p_year, p_month, 1) + interval '1 month - 1 day',
    make_date(p_year, p_month, 1) + (p_day - 1 || ' days')::interval
  )::date;
$$;

-- ============================================================================
-- E9c — card_statements: closed → overdue pasado el vencimiento sin saldar.
-- ============================================================================
CREATE FUNCTION public.close_overdue_card_statements()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.card_statements
  SET status = 'overdue', updated_at = now()
  WHERE status = 'closed'
    AND due_date < current_date
    AND paid_amount < statement_balance;
END;
$$;

-- ============================================================================
-- E9e — audit_log: purga por retención, nunca borra 'delete' ni 'role_change'
-- (la bitácora de lo que se borró o de quién ganó/perdió permisos es la que
-- más importa guardar). Retención configurable por `ALTER DATABASE ... SET
-- perze.audit_retention_months = 'N'` en self-host; default 12.
-- ============================================================================
CREATE FUNCTION public.purge_audit_log()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_months int := COALESCE(NULLIF(current_setting('perze.audit_retention_months', true), '')::int, 12);
BEGIN
  DELETE FROM public.audit_log
  WHERE at < now() - (v_months || ' months')::interval
    AND action NOT IN ('delete', 'role_change');
END;
$$;

-- ============================================================================
-- E9f — push_subscriptions: tope por perfil (evita acumular una suscripción
-- por cada re-registro del service worker en el mismo dispositivo tras cada
-- deploy) + caducidad por antigüedad (no hay heartbeat de "sigue viva" en
-- esta tabla — `send-push` ya limpia las que devuelven 410/404 al enviar,
-- esto es el resto: las que nunca más se usan pero tampoco fallan porque
-- nadie les manda nada).
-- ============================================================================
CREATE FUNCTION public.prune_push_subscriptions()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.push_subscriptions
  WHERE created_at < now() - interval '270 days';

  DELETE FROM public.push_subscriptions ps
  WHERE ps.id IN (
    SELECT id FROM (
      SELECT id, row_number() OVER (PARTITION BY profile_id ORDER BY created_at DESC) AS rn
      FROM public.push_subscriptions
    ) ranked
    WHERE ranked.rn > 5
  );
END;
$$;

-- ============================================================================
-- E9a — materializador de recurrentes. `recurring_rules` no tiene
-- `auto_post`/`rrule`/`template` (ese era el shape viejo, reemplazado en
-- Bloque F — ver reconciliación de A2): el shape real es día-del-mes +
-- monto esperado, y `transactions.source` ya reserva el valor `'recurring'`
-- puntualmente para esto. Corre una vez por día; por regla es idempotente
-- (no duplica si ya se cargó un movimiento con ese `recurring_id` en lo que
-- va del período).
--
-- FX: si la moneda de la regla coincide con la base del household no hace
-- falta convertir (`fx_source = 'identity'`, `amount_base = amount`). Si no
-- coincide, se resuelve con la MISMA cadena que el resto de la app —
-- override vigente a la fecha primero, después la cotización más reciente
-- con `as_of <= hoy` — y si no hay ninguna, se guarda igual como `pending`
-- (nunca se bloquea el movimiento, nunca se inventa un rate).
-- ============================================================================
CREATE FUNCTION public.materialize_recurring_transactions()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r RECORD;
  v_period_start date := date_trunc('month', current_date)::date;
  v_last_day int;
  v_target_day int;
  v_rate numeric(24, 12);
  v_amount_base bigint;
  v_fx_source text;
BEGIN
  FOR r IN
    SELECT rr.*, h.base_currency, h.deleted_at AS household_deleted_at
    FROM public.recurring_rules rr
    JOIN public.households h ON h.id = rr.household_id
    WHERE rr.archived_at IS NULL
  LOOP
    IF r.household_deleted_at IS NOT NULL THEN
      CONTINUE;
    END IF;

    v_last_day := extract(day FROM (date_trunc('month', current_date) + interval '1 month - 1 day'))::int;
    v_target_day := LEAST(r.day_of_month, v_last_day);
    IF extract(day FROM current_date)::int != v_target_day THEN
      CONTINUE;
    END IF;

    -- Ya materializada este período — nunca duplica.
    IF EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.recurring_id = r.id AND t.deleted_at IS NULL AND t.occurred_at >= v_period_start
    ) THEN
      CONTINUE;
    END IF;

    IF r.currency_code = r.base_currency THEN
      v_fx_source := 'identity';
      v_rate := 1;
      v_amount_base := r.expected_amount;
    ELSE
      v_rate := NULL;
      SELECT fo.rate INTO v_rate
      FROM public.fx_overrides fo
      WHERE fo.household_id = r.household_id
        AND fo.base_currency = r.currency_code
        AND fo.quote_currency = r.base_currency
        AND fo.valid_from <= current_date
        AND (fo.valid_to IS NULL OR fo.valid_to >= current_date)
      ORDER BY fo.valid_from DESC
      LIMIT 1;

      IF v_rate IS NULL THEN
        SELECT fr.rate INTO v_rate
        FROM public.fx_rates fr
        WHERE fr.base = r.currency_code AND fr.quote = r.base_currency AND fr.as_of <= current_date
        ORDER BY fr.as_of DESC
        LIMIT 1;
        IF v_rate IS NOT NULL THEN v_fx_source := 'api'; END IF;
      ELSE
        v_fx_source := 'manual';
      END IF;

      IF v_rate IS NULL THEN
        v_fx_source := 'pending';
        v_amount_base := NULL;
      ELSE
        v_amount_base := round(r.expected_amount * v_rate);
      END IF;
    END IF;

    INSERT INTO public.transactions (
      id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code,
      fx_rate, fx_source, amount_base, category_id, source, status, visibility, recurring_id
    ) VALUES (
      gen_random_uuid(), r.household_id, r.created_by, r.kind, now(), r.account_id, r.expected_amount, r.currency_code,
      v_rate, v_fx_source, v_amount_base, r.category_id, 'recurring', 'cleared', 'household', r.id
    );
  END LOOP;
END;
$$;

-- ============================================================================
-- E9b/E9d — notificaciones automáticas hacia `send-push` (hoy la función
-- existe pero, como documenta su propio header, "no se llama sola"). Tres
-- de los cuatro tipos de `notification_preferences` se disparan acá:
--
--   budget_alerts      — un presupuesto cruza 90% del límite en su período
--                        en curso (misma moneda que la base del household;
--                        si el presupuesto está en otra moneda se omite en
--                        vez de mezclar montos de dos monedas distintas).
--   recurring_reminders — aviso de que una recurrente se materializó hoy
--                        (E9a arriba) — recibo de algo que pasó sin que el
--                        usuario lo tipeara.
--   weekly_summary     — al abrir un período nuevo (hoy == period_start_day
--                        del household), resumen del que acaba de cerrar.
--
-- `insights` (el cuarto tipo) NO se dispara acá: no hay motor de detección
-- de anomalías del lado servidor que reusar — inventar uno es una feature
-- nueva, no este fix. Reportado como pendiente, igual que E19 en el propio
-- documento de auditoría.
--
-- De-dup: se usa `audit_log` como bitácora liviana (`entity = 'notification'`,
-- `entity_id` = la fila que originó el aviso, `action` = el tipo) — antes de
-- mandar un push se chequea que no exista ya una entrada para ESTE household/
-- entidad/período; recién si no está, se manda y se deja la entrada. Evita
-- inventar una tabla nueva solo para no repetir un aviso.
-- ============================================================================
CREATE FUNCTION public.dispatch_due_notifications()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_url text;
  v_service_key text;
  b RECORD;
  t RECORD;
  h RECORD;
  v_period_start date;
  v_spent bigint;
  v_pct numeric;
BEGIN
  SELECT decrypted_secret INTO v_project_url FROM vault.decrypted_secrets WHERE name = 'perze_project_url';
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'perze_service_role_key';
  IF v_project_url IS NULL OR v_service_key IS NULL THEN
    -- Sin los dos secrets de Vault registrados (ver docs/self-hosting.md),
    -- no hay a dónde mandar el POST — se sale en silencio, no es un error:
    -- el resto de los cron jobs de esta migración no dependen de esto.
    RETURN;
  END IF;

  -- budget_alerts
  FOR b IN
    SELECT bud.*, h2.period_start_day, h2.base_currency
    FROM public.budgets bud
    JOIN public.households h2 ON h2.id = bud.household_id
    WHERE bud.archived_at IS NULL AND bud.currency_code = h2.base_currency
  LOOP
    IF extract(day FROM current_date)::int >= b.period_start_day THEN
      v_period_start := public.clamped_date(extract(year FROM current_date)::int, extract(month FROM current_date)::int, b.period_start_day);
    ELSE
      v_period_start := public.clamped_date(extract(year FROM (current_date - interval '1 month'))::int, extract(month FROM (current_date - interval '1 month'))::int, b.period_start_day);
    END IF;

    SELECT COALESCE(SUM(tx.amount_base), 0) INTO v_spent
    FROM public.transactions tx
    WHERE tx.household_id = b.household_id AND tx.category_id = b.category_id
      AND tx.kind = 'expense' AND tx.deleted_at IS NULL AND tx.amount_base IS NOT NULL
      AND tx.occurred_at >= v_period_start;

    IF b.amount_limit = 0 THEN CONTINUE; END IF;
    v_pct := v_spent::numeric / b.amount_limit::numeric;
    IF v_pct < 0.9 THEN CONTINUE; END IF;

    IF EXISTS (
      SELECT 1 FROM public.audit_log a
      WHERE a.household_id = b.household_id AND a.entity = 'notification' AND a.entity_id = b.id
        AND a.action = 'budget_alerts' AND (a.diff ->> 'period_start') = v_period_start::text
    ) THEN
      CONTINUE;
    END IF;

    PERFORM net.http_post(
      url := v_project_url || '/functions/v1/send-push',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'householdId', b.household_id, 'kind', 'budget_alerts',
        'title', CASE WHEN v_pct >= 1 THEN 'Presupuesto superado' ELSE 'Presupuesto al límite' END,
        'body', b.name || ' — ' || round(v_pct * 100) || '% usado', 'url', '/budgets'
      )
    );
    INSERT INTO public.audit_log (household_id, entity, entity_id, action, diff)
    VALUES (b.household_id, 'notification', b.id, 'budget_alerts', jsonb_build_object('period_start', v_period_start, 'spent', v_spent, 'limit', b.amount_limit));
  END LOOP;

  -- recurring_reminders — recibo de lo que E9a materializó hoy.
  FOR t IN
    SELECT tx.id, tx.household_id, tx.amount, tx.currency_code, rr.name
    FROM public.transactions tx
    JOIN public.recurring_rules rr ON rr.id = tx.recurring_id
    WHERE tx.source = 'recurring' AND tx.occurred_at >= current_date AND tx.deleted_at IS NULL
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.audit_log a
      WHERE a.household_id = t.household_id AND a.entity = 'notification' AND a.entity_id = t.id AND a.action = 'recurring_reminders'
    ) THEN
      CONTINUE;
    END IF;

    PERFORM net.http_post(
      url := v_project_url || '/functions/v1/send-push',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'householdId', t.household_id, 'kind', 'recurring_reminders',
        'title', 'Movimiento recurrente cargado', 'body', t.name, 'url', '/recurring'
      )
    );
    INSERT INTO public.audit_log (household_id, entity, entity_id, action, diff)
    VALUES (t.household_id, 'notification', t.id, 'recurring_reminders', '{}'::jsonb);
  END LOOP;

  -- weekly_summary — al abrir un período nuevo, resumen del que cerró.
  FOR h IN
    SELECT hh.id, hh.base_currency, hh.period_start_day
    FROM public.households hh
    WHERE hh.deleted_at IS NULL AND hh.period_start_day = extract(day FROM current_date)::int
  LOOP
    v_period_start := (date_trunc('month', current_date) - interval '1 month')::date;

    IF EXISTS (
      SELECT 1 FROM public.audit_log a
      WHERE a.household_id = h.id AND a.entity = 'notification' AND a.entity_id = h.id
        AND a.action = 'weekly_summary' AND (a.diff ->> 'period_start') = v_period_start::text
    ) THEN
      CONTINUE;
    END IF;

    PERFORM net.http_post(
      url := v_project_url || '/functions/v1/send-push',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'householdId', h.id, 'kind', 'weekly_summary',
        'title', 'Tu resumen del período está listo', 'body', 'Mirá cómo te fue el mes pasado', 'url', '/'
      )
    );
    INSERT INTO public.audit_log (household_id, entity, entity_id, action, diff)
    VALUES (h.id, 'notification', h.id, 'weekly_summary', jsonb_build_object('period_start', v_period_start));
  END LOOP;
END;
$$;

-- ============================================================================
-- E20 — cron diario de FX: sin esto `fx_rates` queda vacía para siempre
-- (nada más la escribe). Llama a la Edge Function `daily-fx-sync` (nueva,
-- `supabase/functions/daily-fx-sync`) — igual que arriba, sale en silencio
-- si los secrets de Vault no están registrados.
-- ============================================================================
CREATE FUNCTION public.trigger_daily_fx_sync()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_url text;
  v_service_key text;
BEGIN
  SELECT decrypted_secret INTO v_project_url FROM vault.decrypted_secrets WHERE name = 'perze_project_url';
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'perze_service_role_key';
  IF v_project_url IS NULL OR v_service_key IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_project_url || '/functions/v1/daily-fx-sync',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
END;
$$;

-- ============================================================================
-- Programación. Horarios en UTC — pensados para no pisar el horario pico de
-- captura en Uruguay/Argentina/Brasil (madrugada local).
-- ============================================================================
SELECT cron.schedule('perze-daily-fx-sync', '0 9 * * *', 'SELECT public.trigger_daily_fx_sync();');
SELECT cron.schedule('perze-materialize-recurring', '5 9 * * *', 'SELECT public.materialize_recurring_transactions();');
SELECT cron.schedule('perze-dispatch-notifications', '15 9 * * *', 'SELECT public.dispatch_due_notifications();');
SELECT cron.schedule('perze-close-overdue-statements', '0 3 * * *', 'SELECT public.close_overdue_card_statements();');
SELECT cron.schedule('perze-purge-audit-log', '0 4 * * 0', 'SELECT public.purge_audit_log();'); -- domingos
SELECT cron.schedule('perze-prune-push-subscriptions', '30 4 * * 0', 'SELECT public.prune_push_subscriptions();'); -- domingos
