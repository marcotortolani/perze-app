-- Tanda 4 — dos bugs reportados en tarjetas de crédito:
--
-- 1. MULTI-MONEDA: una tarjeta argentina real permite pagar en ARS y en
--    USD ("dólar tarjeta" para consumos en el exterior), cada saldo con su
--    propio resumen y su propio pago. El modelo actual (una tarjeta =
--    una `accounts.currency_code`) no puede representar eso.
-- 2. FECHAS DE CICLO: `statement_day`/`due_day` eran días fijos y
--    `open_card_statements()` cerraba el resumen SOLO, sin que el usuario
--    confirmara nada — un banco que corre el cierre ("último jueves hábil
--    del mes") deja el resumen calculado desalineado del real, y la app
--    lo daba por bueno igual.
--
-- Modelo elegido (decisión ya cerrada, no se rediscute acá):
--
-- `account_groups`: pieza REUTILIZABLE, no un parche de tarjetas — una
-- entidad que agrupa cuentas y les presta atributos compartidos. `kind`
-- deja lugar a otros usos futuros (agrupar cuentas de un mismo banco,
-- etc.); hoy solo existe `'credit_card'`, con sus columnas específicas
-- nullable. El grupo es dueño del LÍMITE y del CICLO — nunca la cuenta:
-- es el mismo plástico, el mismo corte, es imposible que ARS y USD cierren
-- en fechas distintas, así que ponerlo un nivel arriba lo hace imposible
-- por construcción en vez de por convención.
--
-- Multi-moneda: una cuenta `credit_card` por moneda, agrupadas bajo un
-- `account_group` — reusa el mecanismo que YA existe para "BBVA ARS" /
-- "BBVA USD" como cuentas separadas, en vez de inventar un segundo
-- mecanismo de multi-moneda. Cada cuenta conserva su propio
-- `card_statements`, su propio saldo, su propio pago.
--
-- Ciclo: `statement_day`/`due_day` pasan a ser una ESTIMACIÓN (viven en el
-- grupo, ya no en la cuenta) que solo sirve para PROYECTAR el próximo
-- corte — nunca la verdad. `card_statements` gana `projection_status`
-- ('projected'/'confirmed'). El cron sigue abriendo/proyectando el ciclo
-- todos los días (`open_card_statements`, sin cambios en el cálculo de
-- fechas), pero YA NO LO CIERRA SOLO — `close_overdue_card_statements()`
-- se neutraliza. El cierre real ocurre cuando el usuario confirma con
-- "Llegó el resumen" (`confirm_card_statement`, más abajo), con los tres
-- datos reales del banco. Un ciclo `projected` no dispara notificación de
-- vencimiento — avisar con una fecha que todavía es una adivinanza sería
-- mentir con confianza.
--
-- Principio que esto no cambia: el saldo del pasivo (`accounts.current_balance`)
-- NUNCA dependió de estas fechas — es `opening_balance + Σ(transactions)`,
-- vía el trigger de siempre. Las fechas de ciclo son una capa de
-- agrupación y notificación por encima; si están mal, en el peor caso un
-- consumo cae en el período que no es, pero el saldo real nunca se
-- corrompe. Por eso es seguro que la proyección ande floja entre
-- confirmaciones.

CREATE TABLE public.account_groups (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  kind text NOT NULL CHECK (kind IN ('credit_card')),
  name text NOT NULL,

  -- credit_card — nullable: si en el futuro se suma otro `kind`, sus
  -- columnas van acá mismo, nullable para todo grupo que no sea ese kind.
  credit_limit bigint,
  limit_currency text REFERENCES public.currencies (code),
  -- Semilla de la PROYECCIÓN del ciclo — nunca la fecha real, ver comentario de arriba.
  statement_day smallint,
  due_day smallint,

  created_by uuid NOT NULL REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  deleted_at timestamptz,
  -- CQ (`20260801150000_client_rev_conflict_sensitive.sql`): sin esto,
  -- dos miembros editando el mismo grupo (p. ej. el límite) se pisan en
  -- silencio con "el último que sincroniza gana".
  client_rev integer NOT NULL DEFAULT 1
);

CREATE INDEX account_groups_household_idx ON public.account_groups (household_id) WHERE deleted_at IS NULL;

ALTER TABLE public.account_groups ENABLE ROW LEVEL SECURITY;

-- Mismo patrón que accounts: select por household+visibilidad implícita
-- (un grupo no tiene owner propio — hereda la del household, como
-- transactions), insert/update con can_write, household_id inmutable.
CREATE POLICY account_groups_select ON public.account_groups FOR SELECT
USING (
  deleted_at IS NULL
  AND household_id IN (SELECT public.current_households())
);

CREATE POLICY account_groups_insert ON public.account_groups FOR INSERT
WITH CHECK (public.can_write(household_id) AND created_by = (SELECT auth.uid()));

CREATE POLICY account_groups_update ON public.account_groups FOR UPDATE
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (
  household_id = (SELECT account_groups.household_id)
  AND created_by = (SELECT account_groups.created_by)
);
-- DELETE no se expone — mismo criterio que accounts: el borrado es un UPDATE que setea deleted_at.

ALTER TABLE public.accounts ADD COLUMN account_group_id uuid REFERENCES public.account_groups (id);
CREATE INDEX accounts_account_group_idx ON public.accounts (account_group_id) WHERE account_group_id IS NOT NULL;

-- Estado de la proyección — no confundir con la columna `status` que ya
-- existe (`open`/`closed`/`paid`/`overdue`, el ciclo de vida del PAGO).
-- Este es ortogonal: si las FECHAS/TOTAL de esta fila son una proyección
-- o el dato real que confirmó el usuario. Las filas ya existentes quedan
-- `confirmed` — no hay que reabrir retroactivamente algo que el usuario
-- nunca cuestionó.
ALTER TABLE public.card_statements ADD COLUMN projection_status text NOT NULL DEFAULT 'confirmed'
  CHECK (projection_status IN ('projected', 'confirmed'));

-- `open_card_statements()` — sin cambios en el CÁLCULO de fechas
-- (`card_statement_cycle`, sigue siendo la semilla/estimación), pero:
--   1. usa el `statement_day`/`due_day` del GRUPO cuando la cuenta
--      pertenece a uno (multi-moneda); si no, los de la propia cuenta
--      (compatibilidad con tarjetas sin agrupar).
--   2. las filas que abre/realinea son SIEMPRE 'projected' — la
--      confirmación es un acto separado, nunca automático.
--   3. YA NO CIERRA nada por fecha (se borra el UPDATE final que hacía
--      `status = 'closed'/'paid'` cuando `closing_date < current_date`)
--      — eso ahora es exclusivo de `confirm_card_statement()`.
CREATE OR REPLACE FUNCTION public.open_card_statements()
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
    SELECT
      acc.id,
      COALESCE(ag.statement_day, acc.statement_day) AS statement_day,
      COALESCE(ag.due_day, acc.due_day) AS due_day,
      acc.currency_code
    FROM public.accounts acc
    LEFT JOIN public.account_groups ag ON ag.id = acc.account_group_id AND ag.deleted_at IS NULL
    WHERE acc.kind = 'credit_card'
      AND COALESCE(ag.statement_day, acc.statement_day) IS NOT NULL
      AND COALESCE(ag.due_day, acc.due_day) IS NOT NULL
      AND acc.archived_at IS NULL
      AND acc.deleted_at IS NULL
  LOOP
    SELECT * INTO c FROM public.card_statement_cycle(a.statement_day, a.due_day, current_date);

    SELECT id, period_start INTO v_existing_open, v_existing_period
    FROM public.card_statements
    WHERE account_id = a.id AND status = 'open';

    IF v_existing_open IS NULL THEN
      INSERT INTO public.card_statements
        (id, account_id, period_start, period_end, closing_date, due_date, statement_balance, minimum_payment, currency_code, paid_amount, status, projection_status)
      VALUES
        (gen_random_uuid(), a.id, c.period_start, c.period_end, c.closing_date, c.due_date, 0, NULL, a.currency_code, 0, 'open', 'projected')
      ON CONFLICT (account_id, period_start) DO NOTHING;
    ELSIF v_existing_period IS DISTINCT FROM c.period_start THEN
      UPDATE public.card_statements
      SET period_start = c.period_start, period_end = c.period_end, closing_date = c.closing_date, due_date = c.due_date, updated_at = now()
      WHERE id = v_existing_open;
    END IF;
  END LOOP;

  -- Recalcula el saldo de todo resumen ABIERTO — proyectado o confirmado,
  -- el total sigue siendo derivable en vivo de las transacciones reales
  -- (principio de arriba: el saldo nunca depende de las fechas). Un
  -- resumen ya confirmado sigue en `status = 'open'` hasta que
  -- `confirm_card_statement()` lo cierra de verdad, así que este UPDATE
  -- lo sigue alcanzando y mostrando el acumulado al día.
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
END;
$$;

-- `close_overdue_card_statements()` — neutralizada, no se borra (el cron
-- que la llama sigue programado; se deja como no-op documentado en vez de
-- des-programar el job, más simple de auditar que un DROP). El cierre por
-- fecha era exactamente el bug: ahora cerrar es SIEMPRE
-- `confirm_card_statement()`, con datos reales.
CREATE OR REPLACE FUNCTION public.close_overdue_card_statements()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- No-op a propósito — ver comentario de la migración
  -- 20260812090000_account_groups_card_multicurrency.sql.
END;
$$;

-- Confirmación manual — el único camino real para cerrar un ciclo. Recibe
-- los tres datos que el usuario lee del resumen real del banco y:
--   1. los pisa sobre la fila (closing_date/due_date/statement_balance),
--      marca `projection_status = 'confirmed'` y cierra de verdad
--      (`status = 'closed'`, o `'paid'` si ya no queda saldo pendiente).
--   2. abre el PRÓXIMO ciclo como proyección, con la misma semilla de
--      `statement_day`/`due_day` (que el usuario puede corregir en el
--      grupo si el banco cambió el día de corte) — así la pantalla nunca
--      queda sin "ciclo actual" entre una confirmación y la siguiente.
-- SECURITY DEFINER + can_write: mismo criterio que el resto de las RPCs
-- de escritura de household (`move_accounts_to_household`, etc.) — la
-- fila de `card_statements` no tiene RLS propia más allá de
-- `card_statements_all` (hereda de `accounts`), así que esta función
-- valida el acceso ella misma antes de tocar nada.
CREATE FUNCTION public.confirm_card_statement(
  p_statement_id uuid,
  p_closing_date date,
  p_due_date date,
  p_statement_balance bigint
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_account_id uuid;
  v_household_id uuid;
  v_paid_amount bigint;
  v_period_start date;
  v_statement_day int;
  v_due_day int;
  v_currency_code text;
  c RECORD;
BEGIN
  SELECT cs.account_id, cs.paid_amount, cs.period_start, a.household_id, a.currency_code,
         COALESCE(ag.statement_day, a.statement_day), COALESCE(ag.due_day, a.due_day)
    INTO v_account_id, v_paid_amount, v_period_start, v_household_id, v_currency_code, v_statement_day, v_due_day
  FROM public.card_statements cs
  JOIN public.accounts a ON a.id = cs.account_id
  LEFT JOIN public.account_groups ag ON ag.id = a.account_group_id AND ag.deleted_at IS NULL
  WHERE cs.id = p_statement_id;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'card_statements no encontrado';
  END IF;
  IF NOT public.can_write(v_household_id) THEN
    RAISE EXCEPTION 'No podés escribir en este household';
  END IF;
  IF p_closing_date < v_period_start THEN
    RAISE EXCEPTION 'La fecha de cierre no puede ser anterior al inicio del período';
  END IF;

  UPDATE public.card_statements
  SET closing_date = p_closing_date,
      period_end = p_closing_date,
      due_date = p_due_date,
      statement_balance = p_statement_balance,
      projection_status = 'confirmed',
      status = CASE WHEN p_statement_balance <= v_paid_amount THEN 'paid' ELSE 'closed' END,
      updated_at = now()
  WHERE id = p_statement_id;

  -- Abre el próximo ciclo ya, como proyección — sin esto, la pantalla de
  -- la tarjeta se queda sin "ciclo actual" hasta la próxima corrida del
  -- cron (hasta 24hs de nada que mostrar justo después de confirmar).
  IF v_statement_day IS NOT NULL AND v_due_day IS NOT NULL THEN
    SELECT * INTO c FROM public.card_statement_cycle(v_statement_day, v_due_day, current_date);
    INSERT INTO public.card_statements
      (id, account_id, period_start, period_end, closing_date, due_date, statement_balance, minimum_payment, currency_code, paid_amount, status, projection_status)
    VALUES
      (gen_random_uuid(), v_account_id, c.period_start, c.period_end, c.closing_date, c.due_date, 0, NULL, v_currency_code, 0, 'open', 'projected')
    ON CONFLICT (account_id, period_start) DO NOTHING;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_card_statement(uuid, date, date, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_card_statement(uuid, date, date, bigint) TO authenticated;

-- `dispatch_due_notifications()` — el loop `card_statement_due` (vencimiento
-- próximo) y el `card_statement_overdue` ahora excluyen `projection_status
-- = 'projected'`: avisar "vence el DD/MM" con una fecha que es una
-- adivinanza propia (no confirmada por el banco) es mentir con confianza.
-- Resto de la función carácter por carácter igual a
-- `20260804010000_card_statement_autoopen.sql`.
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

  -- recurring_reminders
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

  -- weekly_summary
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

  -- card_statement_due — se agrega `AND cs.projection_status = 'confirmed'`
  -- respecto de la versión anterior (`20260804010000_card_statement_autoopen.sql`).
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

  -- card_statement_overdue — `close_overdue_card_statements()` está
  -- neutralizada (ver arriba), así que `status = 'overdue'` ya no lo
  -- setea nadie más de acá en adelante — el loop queda igual por si
  -- quedan filas viejas en ese estado de antes de esta migración.
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
