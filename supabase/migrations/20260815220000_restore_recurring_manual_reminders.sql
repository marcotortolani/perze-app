-- Restaura el loop `recurring_manual_reminder` de `dispatch_due_notifications()`,
-- perdido silenciosamente por `20260812090000_account_groups_card_multicurrency.sql`.
--
-- Esa migración reescribió la función entera para agregar `AND cs.projection_status
-- = 'confirmed'` a los dos loops de `card_statement`, pero su comentario dice
-- "Resto de la función carácter por carácter igual a
-- `20260804010000_card_statement_autoopen.sql`" — y esa versión de referencia es
-- ANTERIOR a `20260807170000_recurring_manual_reminders.sql`, que había sumado el
-- loop de recordatorios de recurrentes manuales (día previo/día exacto/día
-- posterior). El resultado: desde el 12/08 la función nunca volvió a avisar de
-- un recurrente manual pendiente — cero filas de `action = 'recurring_manual_reminder'`
-- en `audit_log` desde que existe la columna, verificado contra el proyecto
-- remoto. Exactamente el defecto que `CLAUDE.md` § "un documento, una copia"
-- describe para markdown, pero acá aplicado a una función SQL: dos ediciones en
-- paralelo del mismo cuerpo, y la más reciente pisó a la otra sin fusionar.
--
-- Esta migración es la unión de las dos: el loop de recurrentes manuales de
-- `20260807170000` + el `projection_status = 'confirmed'` de `20260812090000`.
-- Nada más cambia.
CREATE OR REPLACE FUNCTION public.dispatch_due_notifications()
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
  s RECORD;
  v_period_start date;
  v_spent bigint;
  v_pct numeric;
BEGIN
  SELECT decrypted_secret INTO v_project_url FROM vault.decrypted_secrets WHERE name = 'perze_project_url';
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'perze_service_role_key';
  IF v_project_url IS NULL OR v_service_key IS NULL THEN
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

  -- recurring_reminders — recibo de lo que E9a materializó hoy (auto-registro ON).
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

  -- recurring_manual_reminder — recordatorios de recurrentes con
  -- auto-registro OFF: día previo, día exacto, día posterior sin cargar.
  -- Se excluye cualquier ocurrencia que ya tenga movimiento cargado
  -- (`recurring_occurrence_date`, no `occurred_at` — una carga manual
  -- tardía usa la fecha real de pago, no la del período).
  FOR t IN
    SELECT rr.id, rr.household_id, occ.d AS occurrence_date, 'day_before' AS phase,
      'Mañana vence ' || rr.name AS title,
      'Mañana tenés que ' || (CASE WHEN rr.kind = 'expense' THEN 'pagar' ELSE 'cobrar' END) || ' ' || rr.name AS body
    FROM public.recurring_rules rr
    CROSS JOIN LATERAL public.recurring_occurrences_between(rr.frequency, rr.anchor_date, rr.day_of_month, current_date + 1, current_date + 1) AS occ(d)
    WHERE rr.archived_at IS NULL AND NOT rr.auto_post
      AND NOT EXISTS (SELECT 1 FROM public.transactions tx WHERE tx.recurring_id = rr.id AND tx.recurring_occurrence_date = occ.d AND tx.deleted_at IS NULL)

    UNION ALL

    SELECT rr.id, rr.household_id, occ.d, 'day_of',
      'Hoy vence ' || rr.name,
      'Hoy se debe ' || (CASE WHEN rr.kind = 'expense' THEN 'pagar' ELSE 'cobrar' END) || ' ' || rr.name
    FROM public.recurring_rules rr
    CROSS JOIN LATERAL public.recurring_occurrences_between(rr.frequency, rr.anchor_date, rr.day_of_month, current_date, current_date) AS occ(d)
    WHERE rr.archived_at IS NULL AND NOT rr.auto_post
      AND NOT EXISTS (SELECT 1 FROM public.transactions tx WHERE tx.recurring_id = rr.id AND tx.recurring_occurrence_date = occ.d AND tx.deleted_at IS NULL)

    UNION ALL

    SELECT rr.id, rr.household_id, occ.d, 'day_after',
      'Venció ' || rr.name,
      'Ayer se venció el ' || (CASE WHEN rr.kind = 'expense' THEN 'pago' ELSE 'cobro' END) || ' de ' || rr.name
    FROM public.recurring_rules rr
    CROSS JOIN LATERAL public.recurring_occurrences_between(rr.frequency, rr.anchor_date, rr.day_of_month, current_date - 1, current_date - 1) AS occ(d)
    WHERE rr.archived_at IS NULL AND NOT rr.auto_post
      AND NOT EXISTS (SELECT 1 FROM public.transactions tx WHERE tx.recurring_id = rr.id AND tx.recurring_occurrence_date = occ.d AND tx.deleted_at IS NULL)
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.audit_log a
      WHERE a.household_id = t.household_id AND a.entity = 'notification' AND a.entity_id = t.id
        AND a.action = 'recurring_manual_reminder'
        AND (a.diff ->> 'occurrence_date') = t.occurrence_date::text
        AND (a.diff ->> 'phase') = t.phase
    ) THEN
      CONTINUE;
    END IF;

    PERFORM net.http_post(
      url := v_project_url || '/functions/v1/send-push',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'householdId', t.household_id, 'kind', 'recurring_reminders',
        'title', t.title, 'body', t.body, 'url', '/recurring'
      )
    );
    INSERT INTO public.audit_log (household_id, entity, entity_id, action, diff)
    VALUES (t.household_id, 'notification', t.id, 'recurring_manual_reminder', jsonb_build_object('occurrence_date', t.occurrence_date, 'phase', t.phase));
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

  -- card_statement_due — excluye `projection_status = 'projected'`: avisar
  -- "vence el DD/MM" con una fecha que es una adivinanza propia (no
  -- confirmada por el banco) es mentir con confianza.
  FOR s IN
    SELECT cs.id AS statement_id, cs.due_date, cs.statement_balance, cs.paid_amount,
           acc.id AS account_id, acc.household_id, acc.name AS account_name
    FROM public.card_statements cs
    JOIN public.accounts acc ON acc.id = cs.account_id
    WHERE cs.status IN ('open', 'closed')
      AND cs.projection_status = 'confirmed'
      AND cs.paid_amount < cs.statement_balance
      AND cs.due_date <= current_date + interval '3 days'
      AND cs.due_date >= current_date
      AND acc.archived_at IS NULL
      AND acc.deleted_at IS NULL
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.audit_log a
      WHERE a.household_id = s.household_id AND a.entity = 'notification' AND a.entity_id = s.statement_id
        AND a.action = 'card_statement_due' AND (a.diff ->> 'due_date') = s.due_date::text
    ) THEN
      CONTINUE;
    END IF;

    PERFORM net.http_post(
      url := v_project_url || '/functions/v1/send-push',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'householdId', s.household_id, 'kind', 'card_statement_due',
        'title', 'Vence tu tarjeta', 'body', s.account_name || ' vence el ' || to_char(s.due_date, 'DD/MM'), 'url', '/accounts/' || s.account_id || '/card'
      )
    );
    INSERT INTO public.audit_log (household_id, entity, entity_id, action, diff)
    VALUES (s.household_id, 'notification', s.statement_id, 'card_statement_due', jsonb_build_object('due_date', s.due_date));
  END LOOP;

  -- card_statement_overdue — mismo `kind` de push, mensaje y clave de dedup
  -- distintos (ver nota arriba del encabezado de esta función).
  FOR s IN
    SELECT cs.id AS statement_id, cs.due_date, cs.statement_balance, cs.paid_amount,
           acc.id AS account_id, acc.household_id, acc.name AS account_name
    FROM public.card_statements cs
    JOIN public.accounts acc ON acc.id = cs.account_id
    WHERE cs.status = 'overdue'
      AND cs.projection_status = 'confirmed'
      AND cs.paid_amount < cs.statement_balance
      AND acc.archived_at IS NULL
      AND acc.deleted_at IS NULL
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.audit_log a
      WHERE a.household_id = s.household_id AND a.entity = 'notification' AND a.entity_id = s.statement_id
        AND a.action = 'card_statement_overdue' AND (a.diff ->> 'week') = to_char(current_date, 'IYYY-IW')
    ) THEN
      CONTINUE;
    END IF;

    PERFORM net.http_post(
      url := v_project_url || '/functions/v1/send-push',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'householdId', s.household_id, 'kind', 'card_statement_due',
        'title', 'Tu tarjeta está vencida',
        'body', s.account_name || ' venció hace ' || (current_date - s.due_date) || ' días',
        'url', '/accounts/' || s.account_id || '/card'
      )
    );
    INSERT INTO public.audit_log (household_id, entity, entity_id, action, diff)
    VALUES (s.household_id, 'notification', s.statement_id, 'card_statement_overdue', jsonb_build_object('week', to_char(current_date, 'IYYY-IW')));
  END LOOP;
END;
$$;
