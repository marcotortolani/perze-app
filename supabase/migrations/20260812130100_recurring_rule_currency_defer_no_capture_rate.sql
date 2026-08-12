-- Corrige `20260812130000_recurring_rule_currency.sql`: guardar la
-- primera conversión (regla → cuenta) con `amount = 0` cuando no hay
-- cotización viola `amount_sign` (`CHECK (kind = ANY (ARRAY['adjustment',
-- 'investing']) OR amount > 0)`, `20260808000000_investing_transactions.sql`)
-- para gasto/ingreso — que es exactamente lo que un recurrente materializa.
--
-- El cliente (`convertRuleAmountToAccount`, espejo de A3 en
-- `save-transaction.ts`) puede guardar ese placeholder porque Dexie no
-- tiene CHECK constraints — ahí es local y se corrige después. Acá el
-- `INSERT` cae directo en Postgres: sin manejo por ocurrencia, la
-- violación abortaría `materialize_recurring_transactions()` ENTERA,
-- rompiendo el auto-registro de todas las demás reglas de la corrida, no
-- solo la que no tenía cotización.
--
-- Sin usuario presente para notar y corregir un $0 en el libro, la
-- corrida automática DIFIERE la ocurrencia entera cuando falta la
-- cotización de la primera conversión: no inserta nada y no avanza
-- `last_materialized_on` más allá de la ocurrencia anterior exitosa, así
-- que se reintenta en la próxima corrida (y en las siguientes, hasta que
-- haya cotización). "Cargar ahora" (cliente, manual) sigue pudiendo
-- resolverla antes, con el mismo criterio que `/add` — ahí sí hay un
-- usuario mirando la pantalla para decidir qué hacer con un movimiento
-- pendiente.

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
  v_last_processed date;
  -- Primera conversión: regla → cuenta.
  v_capture_rate numeric(24, 12);
  v_amount bigint;
  v_original_amount bigint;
  v_original_currency text;
  v_original_rate numeric(24, 12);
  -- Segunda conversión: cuenta → base.
  v_rate numeric(24, 12);
  v_amount_base bigint;
  v_fx_source text;
BEGIN
  FOR r IN
    SELECT rr.*, h.base_currency, h.deleted_at AS household_deleted_at,
           a.currency_code AS account_currency_code
    FROM public.recurring_rules rr
    JOIN public.households h ON h.id = rr.household_id
    JOIN public.accounts a ON a.id = rr.account_id
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
      -- Primera conversión — regla (`r.currency_code`) → cuenta
      -- (`r.account_currency_code`), a la fecha de ESTA ocurrencia (un
      -- catch-up de meses atrás no puede usar la cotización de hoy).
      IF r.currency_code = r.account_currency_code THEN
        v_amount := r.expected_amount;
        v_original_amount := NULL;
        v_original_currency := NULL;
        v_original_rate := NULL;
      ELSE
        v_capture_rate := NULL;
        SELECT fo.rate INTO v_capture_rate
        FROM public.fx_overrides fo
        WHERE fo.household_id = r.household_id
          AND fo.base_currency = r.currency_code
          AND fo.quote_currency = r.account_currency_code
          AND fo.valid_from <= v_day
          AND (fo.valid_to IS NULL OR fo.valid_to >= v_day)
        ORDER BY fo.valid_from DESC
        LIMIT 1;

        IF v_capture_rate IS NULL THEN
          SELECT fr.rate INTO v_capture_rate
          FROM public.fx_rates fr
          WHERE fr.base = r.currency_code AND fr.quote = r.account_currency_code AND fr.as_of <= v_day
          ORDER BY fr.as_of DESC
          LIMIT 1;
        END IF;

        IF v_capture_rate IS NULL THEN
          -- Diferir: ni se inserta esta ocurrencia ni ninguna posterior en
          -- esta corrida (`EXIT` corta el `FOR v_day` entero) — si esta
          -- fecha no consiguió cotización, seguir de largo con la
          -- siguiente ocurrencia dejaría un hueco sin marcar en el medio
          -- del historial. `v_last_processed` conserva la última
          -- ocurrencia realmente insertada (o `NULL`), así que
          -- `last_materialized_on` nunca avanza más allá de acá.
          EXIT;
        END IF;

        v_original_amount := r.expected_amount;
        v_original_currency := r.currency_code;
        v_original_rate := v_capture_rate;
        v_amount := public.convert_minor(
          r.expected_amount, v_capture_rate,
          public.currency_decimals(r.currency_code), public.currency_decimals(r.account_currency_code)
        );
      END IF;

      v_last_processed := v_day;

      -- Segunda conversión — cuenta → base. Sin cambios de fondo respecto
      -- a `20260812130000`; ahora parte del monto YA convertido
      -- (`v_amount`/`r.account_currency_code`), no de
      -- `r.expected_amount`/`r.currency_code` directo.
      IF r.account_currency_code = r.base_currency THEN
        v_fx_source := 'identity';
        v_rate := 1;
        v_amount_base := v_amount;
      ELSE
        v_rate := NULL;
        SELECT fo.rate INTO v_rate
        FROM public.fx_overrides fo
        WHERE fo.household_id = r.household_id
          AND fo.base_currency = r.account_currency_code
          AND fo.quote_currency = r.base_currency
          AND fo.valid_from <= v_day
          AND (fo.valid_to IS NULL OR fo.valid_to >= v_day)
        ORDER BY fo.valid_from DESC
        LIMIT 1;

        IF v_rate IS NULL THEN
          SELECT fr.rate INTO v_rate
          FROM public.fx_rates fr
          WHERE fr.base = r.account_currency_code AND fr.quote = r.base_currency AND fr.as_of <= v_day
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
          v_amount_base := public.convert_minor(
            v_amount, v_rate,
            public.currency_decimals(r.account_currency_code), public.currency_decimals(r.base_currency)
          );
        END IF;
      END IF;

      INSERT INTO public.transactions (
        id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code,
        original_amount, original_currency, original_rate,
        fx_rate, fx_source, amount_base, category_id, source, status, visibility, recurring_id, recurring_occurrence_date
      ) VALUES (
        gen_random_uuid(), r.household_id, r.created_by, r.kind, (v_day::text || ' 12:00:00+00')::timestamptz, r.account_id, v_amount, r.account_currency_code,
        v_original_amount, v_original_currency, v_original_rate,
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
