-- E4 — apertura automática de `card_statements`. Hasta acá `cardStatementsRepo.create`
-- nunca tenía un llamador real (el comentario del repo decía "carga manual por
-- ciclo", pero jamás se construyó esa pantalla) — sin una fila de `card_statements`,
-- el botón "Pagar la tarjeta" del ciclo quedaba permanentemente deshabilitado
-- (`disabled={!latestStatement || ...}`) y el recordatorio de vencimiento de
-- `dispatch_due_notifications()` (`20260803000000_card_settlement.sql`) nunca
-- tenía una `due_date` que evaluar. Esta migración cierra ese gap: un cron diario
-- abre/realinea el resumen del ciclo en curso y recalcula su saldo desde las
-- transacciones reales de la cuenta.
--
-- Sin tabla nueva, sin política RLS nueva — `card_statements` ya tiene
-- `card_statements_all` (`20260801080000_...sql`), y la función de este archivo
-- es `SECURITY DEFINER` (bypassea RLS por diseño, mismo patrón que
-- `materialize_recurring_transactions()`).

-- A lo sumo un resumen por ciclo (evita duplicar si el cron corre dos veces
-- el mismo día, o si alguna vez se agrega un alta manual).
CREATE UNIQUE INDEX card_statements_account_period_uidx
  ON public.card_statements (account_id, period_start);

-- A lo sumo un resumen ABIERTO por cuenta. Además de guarda de duplicados,
-- es la defensa contra cambiar `statement_day`/`due_day` a mitad de ciclo:
-- en vez de insertar un segundo resumen abierto que se superpone con el
-- primero (doble conteo de las mismas transacciones), `open_card_statements()`
-- more abajo REALINEA el único resumen abierto a las fechas nuevas.
CREATE UNIQUE INDEX card_statements_one_open_uidx
  ON public.card_statements (account_id) WHERE status = 'open';

-- Cálculo del ciclo — gemela exacta de `cardCycle()` en
-- `src/lib/analytics/card-cycle.ts` (mismo comentario en las dos, para que
-- no diverjan en silencio). Usa `clamped_date()` (`20260801160000_cron_engines.sql`)
-- para meses cortos ("31 de febrero"). Regla del vencimiento: si el
-- `due_day` calculado en el mes del cierre cae ANTES del cierre, el
-- vencimiento es en el mes siguiente (nunca antes de cerrar el resumen).
CREATE FUNCTION public.card_statement_cycle(p_statement_day int, p_due_day int, p_ref date)
RETURNS TABLE (period_start date, period_end date, closing_date date, due_date date)
LANGUAGE sql IMMUTABLE
AS $$
  WITH base AS (
    SELECT
      CASE
        WHEN public.clamped_date(extract(year FROM p_ref)::int, extract(month FROM p_ref)::int, p_statement_day) <= p_ref
          THEN public.clamped_date(extract(year FROM p_ref)::int, extract(month FROM p_ref)::int, p_statement_day)
        ELSE public.clamped_date(extract(year FROM (p_ref - interval '1 month'))::int, extract(month FROM (p_ref - interval '1 month'))::int, p_statement_day)
      END AS v_period_start
  ),
  closing AS (
    SELECT
      v_period_start,
      public.clamped_date(extract(year FROM (v_period_start + interval '1 month'))::int, extract(month FROM (v_period_start + interval '1 month'))::int, p_statement_day) - 1 AS v_closing_date
    FROM base
  ),
  due AS (
    SELECT
      v_period_start,
      v_closing_date,
      public.clamped_date(extract(year FROM v_closing_date)::int, extract(month FROM v_closing_date)::int, p_due_day) AS v_due_candidate
    FROM closing
  )
  SELECT
    v_period_start,
    v_closing_date AS period_end,
    v_closing_date AS closing_date,
    CASE
      WHEN v_due_candidate < v_closing_date
        THEN public.clamped_date(extract(year FROM (v_closing_date + interval '1 month'))::int, extract(month FROM (v_closing_date + interval '1 month'))::int, p_due_day)
      ELSE v_due_candidate
    END AS due_date
  FROM due;
$$;

-- Abre/realinea el resumen del ciclo en curso de cada tarjeta y recalcula
-- el saldo de todos los resúmenes abiertos. Corre una vez por día, antes
-- de `close_overdue_card_statements()` (03:00) y de
-- `dispatch_due_notifications()` (09:15) — ver el `cron.schedule` al final.
CREATE FUNCTION public.open_card_statements()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  a RECORD;
  c RECORD;
  v_existing_open uuid;
  v_existing_period date;
BEGIN
  FOR a IN
    SELECT acc.id, acc.statement_day, acc.due_day, acc.currency_code
    FROM public.accounts acc
    WHERE acc.kind = 'credit_card'
      AND acc.statement_day IS NOT NULL
      AND acc.due_day IS NOT NULL
      AND acc.archived_at IS NULL
      AND acc.deleted_at IS NULL
  LOOP
    SELECT * INTO c FROM public.card_statement_cycle(a.statement_day, a.due_day, current_date);

    SELECT id, period_start INTO v_existing_open, v_existing_period
    FROM public.card_statements
    WHERE account_id = a.id AND status = 'open';

    IF v_existing_open IS NULL THEN
      -- Nada abierto todavía: abre el ciclo actual.
      INSERT INTO public.card_statements
        (id, account_id, period_start, period_end, closing_date, due_date, statement_balance, minimum_payment, currency_code, paid_amount, status)
      VALUES
        (gen_random_uuid(), a.id, c.period_start, c.period_end, c.closing_date, c.due_date, 0, NULL, a.currency_code, 0, 'open')
      ON CONFLICT (account_id, period_start) DO NOTHING;
    ELSIF v_existing_period IS DISTINCT FROM c.period_start THEN
      -- `statement_day`/`due_day` cambiaron a mitad de ciclo (o el resumen
      -- abierto quedó de un cálculo anterior): realinea el ÚNICO resumen
      -- abierto en vez de insertar uno segundo que se superponga.
      UPDATE public.card_statements
      SET period_start = c.period_start, period_end = c.period_end, closing_date = c.closing_date, due_date = c.due_date, updated_at = now()
      WHERE id = v_existing_open;
    END IF;
  END LOOP;

  -- Recalcula el saldo de TODO resumen abierto (no solo el de la cuenta
  -- recién tocada arriba), sumando sus transacciones del período en la
  -- moneda de la cuenta. Sin FX: por la regla cerrada de `CLAUDE.md`
  -- ("dos conversiones, no una"), `amount`/`currency_code` de una
  -- transacción de tarjeta ya están en la moneda de la cuenta — sumar
  -- `amount` directo es correcto, `amount_base` no hace falta acá. Las
  -- transferencias (los pagos) se ignoran a propósito: van a `paid_amount`
  -- vía `markPaid`, nunca reducen `statement_balance`.
  UPDATE public.card_statements cs
  SET statement_balance = COALESCE((
        SELECT SUM(CASE
          WHEN t.kind = 'expense' THEN t.amount
          WHEN t.kind = 'income' THEN -t.amount
          WHEN t.kind = 'adjustment' THEN -t.amount
          ELSE 0
        END)
        FROM public.transactions t
        WHERE t.account_id = cs.account_id
          AND t.deleted_at IS NULL
          AND t.occurred_at >= cs.period_start
          AND t.occurred_at < cs.closing_date + 1
      ), 0),
      updated_at = now()
  WHERE cs.status = 'open';

  -- Cierra los ciclos cuya fecha de cierre ya pasó. Un resumen en cero se
  -- salta directo a `paid` para no generar un recordatorio de vencimiento
  -- por $0.
  UPDATE public.card_statements
  SET status = CASE WHEN statement_balance <= paid_amount THEN 'paid' ELSE 'closed' END,
      updated_at = now()
  WHERE status = 'open' AND closing_date < current_date;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.open_card_statements() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.card_statement_cycle(int, int, date) FROM PUBLIC, anon, authenticated;

-- `close_overdue_card_statements()` (`20260801160000_cron_engines.sql`) no
-- filtraba cuentas archivadas/borradas — una tarjeta archivada con un
-- resumen sin pagar quedaba generando vencimientos para siempre. Mismo
-- criterio en el loop de aviso previo de `dispatch_due_notifications()`
-- más abajo.
CREATE OR REPLACE FUNCTION public.close_overdue_card_statements()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.card_statements cs
  SET status = 'overdue', updated_at = now()
  FROM public.accounts acc
  WHERE acc.id = cs.account_id
    AND cs.status = 'closed'
    AND cs.due_date < current_date
    AND cs.paid_amount < cs.statement_balance
    AND acc.archived_at IS NULL
    AND acc.deleted_at IS NULL;
END;
$$;

-- Re-emite `dispatch_due_notifications()` completa (`20260801160000_cron_engines.sql`,
-- ya extendida una vez por `20260803000000_card_settlement.sql`) — los
-- cuatro loops existentes quedan carácter por carácter iguales, salvo dos
-- cambios puntuales en el loop de `card_statement_due`:
--   1. se agrega el filtro de cuenta archivada/borrada (mismo criterio que
--      `close_overdue_card_statements()` arriba).
--   2. se suma un QUINTO loop para `status = 'overdue'` — hoy un resumen
--      vencido deja de avisar para siempre en cuanto `due_date` queda en
--      el pasado (el loop previo filtra `due_date >= current_date`). Este
--      nuevo loop reusa el mismo `kind: 'card_statement_due'` (mismo
--      toggle de preferencia — no hace falta una sexta columna) pero con
--      una clave de dedup DISTINTA: por semana ISO
--      (`to_char(current_date,'IYYY-IW')`), no por `due_date` — con la
--      clave del loop previo, un vencido avisaría una sola vez (el día que
--      cruza `due_date`) y nunca más. Semanal, no diario: un aviso todos
--      los días es hostigamiento; nunca más es silencio.
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
  -- resumen ya 'paid' no avisa más, y uno 'overdue' se atiende en el loop
  -- de abajo, con su propio mensaje y dedup.
  FOR s IN
    SELECT cs.id AS statement_id, cs.due_date, cs.statement_balance, cs.paid_amount,
           acc.id AS account_id, acc.household_id, acc.name AS account_name
    FROM public.card_statements cs
    JOIN public.accounts acc ON acc.id = cs.account_id
    WHERE cs.status IN ('open', 'closed')
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

-- Programación — 02:00 UTC, ANTES de `perze-close-overdue-statements`
-- (03:00) y `perze-dispatch-notifications` (09:15): el resumen del ciclo
-- tiene que existir/estar recalculado antes de que esos dos jobs lo lean.
SELECT cron.schedule('perze-open-card-statements', '0 2 * * *', 'SELECT public.open_card_statements();');
