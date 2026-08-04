-- Recurrentes v3 — auto-registro por regla, catch-up y multi-frecuencia.
-- Reescribe `materialize_recurring_transactions()` (20260801160000) para que
-- la idempotencia sea `(recurring_id, fecha_de_ocurrencia)` en vez de
-- "¿ya se cargó este período?": de ahí caen el catch-up, las cuatro
-- frecuencias y la ausencia de duplicados de un solo mecanismo. Ver el plan
-- en docs/ (recurrentes) — Contexto, § A y § B.

-- ============================================================================
-- A.2 — columnas nuevas de recurring_rules
-- ============================================================================

ALTER TABLE public.recurring_rules
  ADD COLUMN frequency text NOT NULL DEFAULT 'monthly'
    CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'yearly')),
  ADD COLUMN anchor_date date,
  ADD COLUMN auto_post boolean NOT NULL DEFAULT true,
  ADD COLUMN last_materialized_on date,
  ADD COLUMN end_date date,
  ADD COLUMN detected boolean NOT NULL DEFAULT false;

-- Backfill de `anchor_date`: la fecha de la primera ocurrencia según el mes
-- de creación de la regla — todas las reglas existentes son mensuales.
UPDATE public.recurring_rules
SET anchor_date = public.clamped_date(
  extract(year FROM created_at)::int,
  extract(month FROM created_at)::int,
  day_of_month
)
WHERE anchor_date IS NULL;

-- Backfill del cursor: lo que ya se materializó no se vuelve a crear.
UPDATE public.recurring_rules rr
SET last_materialized_on = s.d
FROM (
  SELECT recurring_id, max((occurred_at AT TIME ZONE 'UTC')::date) AS d
  FROM public.transactions
  WHERE recurring_id IS NOT NULL
  GROUP BY recurring_id
) s
WHERE s.recurring_id = rr.id;

ALTER TABLE public.recurring_rules
  ALTER COLUMN anchor_date SET NOT NULL,
  ALTER COLUMN day_of_month DROP NOT NULL,
  ADD CONSTRAINT recurring_rules_day_of_month_scope
    CHECK ((frequency IN ('monthly', 'yearly')) = (day_of_month IS NOT NULL)),
  ADD CONSTRAINT recurring_rules_end_after_anchor
    CHECK (end_date IS NULL OR end_date >= anchor_date);

-- ============================================================================
-- A.3 — índices. El único es la clave de idempotencia de todo el sistema:
-- SIN `deleted_at IS NULL` a propósito. Si el usuario deshace la carga
-- automática (softDelete), la ocurrencia queda ocupada y ningún motor —ni
-- el cron ni el cliente— la recrea mañana. Acoplado con el mecanismo de
-- deshacer (§ F del plan).
-- ============================================================================

CREATE UNIQUE INDEX transactions_recurring_occurrence_uniq
  ON public.transactions (recurring_id, ((occurred_at AT TIME ZONE 'UTC')::date))
  WHERE recurring_id IS NOT NULL;

CREATE INDEX recurring_rules_autopost_idx
  ON public.recurring_rules (household_id, last_materialized_on)
  WHERE archived_at IS NULL AND auto_post;

-- ============================================================================
-- A.4 — RLS: el `WITH CHECK` de UPDATE era tautológico (comparaba la fila
-- nueva contra sí misma: `household_id = (SELECT recurring_rules.household_id)`
-- siempre es cierto). Hoy solo lo frena el trigger de inmutabilidad; se
-- reemplaza acá por un chequeo real. `budgets` y `goals` tienen el mismo
-- defecto y quedan para su propio bloque.
-- ============================================================================

DROP POLICY recurring_rules_update ON public.recurring_rules;
CREATE POLICY recurring_rules_update ON public.recurring_rules FOR UPDATE
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (household_id IN (SELECT public.current_households()) AND public.can_write(household_id));

-- ============================================================================
-- B — motor de ocurrencias, espejo de `src/lib/recurring/occurrences.ts`.
-- IMMUTABLE: mismos argumentos, mismo resultado, sin leer tablas.
-- ============================================================================

CREATE FUNCTION public.recurring_occurrences_between(
  p_frequency text, p_anchor date, p_day_of_month int, p_from date, p_to date
) RETURNS SETOF date
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_step_days int;
  v_step_months int;
  v_first date;
  v_offset int;
  v_d date;
  v_anchor_month date;
  v_from_month date;
  v_raw_offset int;
  v_k int;
  v_iso date;
BEGIN
  IF p_from > p_to THEN
    RETURN;
  END IF;

  IF p_frequency IN ('weekly', 'biweekly') THEN
    v_step_days := CASE WHEN p_frequency = 'biweekly' THEN 14 ELSE 7 END;
    v_first := GREATEST(p_from, p_anchor);
    IF v_first > p_to THEN
      RETURN;
    END IF;
    v_offset := ((v_first - p_anchor) % v_step_days + v_step_days) % v_step_days;
    v_d := v_first + (CASE WHEN v_offset = 0 THEN 0 ELSE v_step_days - v_offset END);
    WHILE v_d <= p_to LOOP
      RETURN NEXT v_d;
      v_d := v_d + v_step_days;
    END LOOP;
    RETURN;
  END IF;

  -- monthly / yearly — igual que `monthlyOrYearlyOccurrences` en TS: arranca
  -- un paso antes del mes más cercano a `p_from`, nunca mes a mes desde el
  -- ancla, y `clamped_date` hace el trabajo de 31→28/29/30.
  v_step_months := CASE WHEN p_frequency = 'yearly' THEN 12 ELSE 1 END;
  v_anchor_month := date_trunc('month', p_anchor)::date;
  v_from_month := date_trunc('month', GREATEST(p_from, p_anchor))::date;
  v_raw_offset := (extract(year FROM v_from_month)::int - extract(year FROM v_anchor_month)::int) * 12
                + (extract(month FROM v_from_month)::int - extract(month FROM v_anchor_month)::int);
  v_k := (floor(v_raw_offset::numeric / v_step_months)::int - 1) * v_step_months;

  LOOP
    v_iso := public.clamped_date(
      extract(year FROM (v_anchor_month + (v_k || ' months')::interval))::int,
      extract(month FROM (v_anchor_month + (v_k || ' months')::interval))::int,
      p_day_of_month
    );
    EXIT WHEN v_iso > p_to;
    IF v_iso >= p_from AND v_iso >= p_anchor THEN
      RETURN NEXT v_iso;
    END IF;
    v_k := v_k + v_step_months;
  END LOOP;
END;
$$;

-- ============================================================================
-- E9a v3 — reescritura del materializador. Se saca el `CONTINUE unless hoy
-- = día objetivo` (sin catch-up: un `pg_cron` que no corrió un día perdía
-- ese movimiento para siempre) y el chequeo de mes calendario. Filtra por
-- `auto_post`, resuelve FX A LA FECHA DE CADA OCURRENCIA (no a `current_date`
-- — un catch-up de 3 meses atrás no puede usar la cotización de hoy), y
-- topea en 6 ocurrencias por regla por corrida (RECURRING_MAX_PER_RUN,
-- espejo de `src/lib/recurring/materialize.ts`). `last_materialized_on`
-- avanza aunque `ON CONFLICT DO NOTHING` no haya insertado nada — si el
-- cliente ya materializó esa ocurrencia offline, el cron no debe seguir
-- reintentándola todos los días.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.materialize_recurring_transactions()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r RECORD;
  v_floor date;
  v_ceiling date;
  v_day date;
  v_rate numeric(24, 12);
  v_amount_base bigint;
  v_fx_source text;
  v_last_processed date;
BEGIN
  FOR r IN
    SELECT rr.*, h.base_currency, h.deleted_at AS household_deleted_at
    FROM public.recurring_rules rr
    JOIN public.households h ON h.id = rr.household_id
    WHERE rr.archived_at IS NULL AND rr.auto_post
  LOOP
    IF r.household_deleted_at IS NOT NULL THEN
      CONTINUE;
    END IF;

    -- 62 días — dos períodos completos sea cual sea `period_start_day` del
    -- household. Nunca antes del ancla: la app no inventa historia.
    v_floor := GREATEST(r.anchor_date, current_date - 62, COALESCE(r.last_materialized_on + 1, r.anchor_date));
    v_ceiling := LEAST(current_date, COALESCE(r.end_date, current_date));
    IF v_floor > v_ceiling THEN
      CONTINUE;
    END IF;

    v_last_processed := NULL;

    FOR v_day IN
      SELECT occ FROM public.recurring_occurrences_between(r.frequency, r.anchor_date, r.day_of_month, v_floor, v_ceiling) AS occ
      ORDER BY occ
      LIMIT 6
    LOOP
      v_last_processed := v_day;

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
          AND fo.valid_from <= v_day
          AND (fo.valid_to IS NULL OR fo.valid_to >= v_day)
        ORDER BY fo.valid_from DESC
        LIMIT 1;

        IF v_rate IS NULL THEN
          SELECT fr.rate INTO v_rate
          FROM public.fx_rates fr
          WHERE fr.base = r.currency_code AND fr.quote = r.base_currency AND fr.as_of <= v_day
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
        gen_random_uuid(), r.household_id, r.created_by, r.kind, (v_day::text || ' 12:00:00+00')::timestamptz, r.account_id, r.expected_amount, r.currency_code,
        v_rate, v_fx_source, v_amount_base, r.category_id, 'recurring', 'cleared', 'household', r.id
      )
      ON CONFLICT (recurring_id, ((occurred_at AT TIME ZONE 'UTC')::date)) WHERE recurring_id IS NOT NULL DO NOTHING;
    END LOOP;

    IF v_last_processed IS NOT NULL THEN
      UPDATE public.recurring_rules SET last_materialized_on = v_last_processed, updated_at = now() WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;
