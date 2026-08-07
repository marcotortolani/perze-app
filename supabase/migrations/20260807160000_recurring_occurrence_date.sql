-- Recurrentes — desacopla "qué período programado salda este movimiento"
-- (`recurring_occurrence_date`) de "cuándo ocurrió de verdad" (`occurred_at`).
--
-- Hasta acá la clave de idempotencia contra duplicados era
-- `(recurring_id, (occurred_at AT TIME ZONE 'UTC')::date)`: la fecha del
-- movimiento y la fecha del período programado eran la misma columna. Eso
-- rompe con una carga manual tardía (auto-registro OFF): el usuario
-- registra el alquiler de agosto el 7, no el 1 — el gasto ocurre
-- administrativamente el día en que se carga a mano (esa es también la
-- fecha con la que hay que resolver la cotización), pero seguía siendo
-- "el período de agosto" a efectos de no volver a ofrecerlo como
-- pendiente. Con las dos fechas en la misma columna, cambiar `occurred_at`
-- a la fecha real de carga corrompía la idempotencia: dos ocurrencias
-- vencidas cargadas el mismo día colisionaban entre sí.
--
-- `recurring_occurrence_date` es la clave de idempotencia real de acá en
-- adelante. `occurred_at` queda libre para ser la fecha real del
-- movimiento en cualquier caso (automático o manual, a tiempo o tarde).

ALTER TABLE public.transactions
  ADD COLUMN recurring_occurrence_date date;

-- Backfill: todo lo que ya existe asumía `occurred_at` = período. Con esto,
-- ningún movimiento recurrente ya cargado se re-ofrece como pendiente ni
-- se puede duplicar por la ventana en que el índice único no lo cubría.
UPDATE public.transactions
SET recurring_occurrence_date = (occurred_at AT TIME ZONE 'UTC')::date
WHERE recurring_id IS NOT NULL AND recurring_occurrence_date IS NULL;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_recurring_occurrence_date_scope
    CHECK ((recurring_id IS NULL) = (recurring_occurrence_date IS NULL));

DROP INDEX IF EXISTS public.transactions_recurring_occurrence_uniq;

CREATE UNIQUE INDEX transactions_recurring_occurrence_uniq
  ON public.transactions (recurring_id, recurring_occurrence_date)
  WHERE recurring_id IS NOT NULL;

-- El motor automático (auto_post) siempre materializa a tiempo — para él,
-- `recurring_occurrence_date` y `occurred_at` siguen siendo el mismo día.
-- El desacople solo lo usa la carga manual (`chargeRecurringNow`, cliente).
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
        fx_rate, fx_source, amount_base, category_id, source, status, visibility, recurring_id, recurring_occurrence_date
      ) VALUES (
        gen_random_uuid(), r.household_id, r.created_by, r.kind, (v_day::text || ' 12:00:00+00')::timestamptz, r.account_id, r.expected_amount, r.currency_code,
        v_rate, v_fx_source, v_amount_base, r.category_id, 'recurring', 'cleared', 'household', r.id, v_day
      )
      ON CONFLICT (recurring_id, recurring_occurrence_date) WHERE recurring_id IS NOT NULL DO NOTHING;
    END LOOP;

    IF v_last_processed IS NOT NULL THEN
      UPDATE public.recurring_rules SET last_materialized_on = v_last_processed, updated_at = now() WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;
