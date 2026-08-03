-- E4 — liquidación real de resúmenes de tarjeta por transferencia, y aviso
-- de vencimiento. `card_statements.paid_amount`/`markPaid` existían desde
-- `20260801080000...sql` pero nadie los llamaba: el botón "Pagar la
-- tarjeta" solo enrutaba a `/add`. Esta migración agrega el vínculo a la
-- transacción real de liquidación y el quinto tipo de notificación.

ALTER TABLE public.card_statements
  ADD COLUMN settlement_transaction_id uuid REFERENCES public.transactions (id);

ALTER TABLE public.notification_preferences
  ADD COLUMN card_statement_due boolean NOT NULL DEFAULT true;

-- Reemplaza `dispatch_due_notifications()` (definida en `20260801160000...sql`)
-- sumando un cuarto loop. Los tres primeros quedan carácter por carácter
-- iguales; solo se agrega `card_statement_due` al final antes del `END;`.
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

  -- card_statement_due — resumen de tarjeta a 3 días o menos de vencer y
  -- todavía no liquidado del todo. `status IN ('open','closed')`: un
  -- resumen ya 'paid' no avisa más, y uno 'overdue' ya tuvo su aviso de
  -- cierre (E9c en la misma migración de cron) — este es el recordatorio
  -- previo, no el de mora.
  FOR s IN
    SELECT cs.id AS statement_id, cs.due_date, cs.statement_balance, cs.paid_amount,
           acc.id AS account_id, acc.household_id, acc.name AS account_name
    FROM public.card_statements cs
    JOIN public.accounts acc ON acc.id = cs.account_id
    WHERE cs.status IN ('open', 'closed')
      AND cs.paid_amount < cs.statement_balance
      AND cs.due_date <= current_date + interval '3 days'
      AND cs.due_date >= current_date
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
END;
$$;
