-- Recurrentes en una moneda distinta a la de la cuenta que los paga —
-- espejo SQL del motor cliente (`src/lib/recurring/materialize.ts`,
-- `convertRuleAmountToAccount`). `recurring_rules.currency_code` ya
-- significaba "la moneda en la que está expresado `expected_amount`";
-- hasta acá el formulario la forzaba a igualar la de la cuenta y este
-- materializador asumía esa igualdad sin comprobarla. Caso real: el
-- alquiler vale $U 25.000 fijos, pero se paga desde una cuenta en dólares
-- — el cambio se calcula el día del pago, no al crear la regla.
--
-- Reescribe `materialize_recurring_transactions()` (vigente desde
-- `20260807160000_recurring_occurrence_date.sql`) para sumar la PRIMERA
-- conversión (regla → cuenta) antes de la que ya existía (cuenta → base):
-- "SON DOS CONVERSIONES, NO UNA" (`CLAUDE.md`). Sin cotización disponible
-- para la primera, el movimiento se guarda igual con `amount = 0` y la
-- terna `original_*` con `original_rate = NULL` — dispara
-- `needs_capture_fx` (columna generada, `20260801090000_fix_capture_fx_pending.sql`),
-- nunca un rate inventado.
--
-- NOTA — corregido en `20260812130100_recurring_rule_currency_defer_no_capture_rate.sql`:
-- `amount = 0` viola `amount_sign` (exige `amount > 0` para gasto/ingreso)
-- para CUALQUIER `kind` salvo `adjustment`/`investing`. No se edita este
-- archivo — es append-only una vez pusheado (`CLAUDE.md`) — la migración
-- siguiente reemplaza la función entera.

-- ============================================================================
-- Helpers — espejo de `decimalsFor()`/`convert()` en `src/lib/fx/rate.ts`.
-- `currency_decimals` es STABLE (lee `currencies`, referencia que no muta
-- en el camino de este materializador); `convert_minor` es matemática pura
-- sobre esos decimales, IMMUTABLE de verdad. El `round()` del que ya
-- existía (`round(amount * rate)`) asumía la misma cantidad de decimales
-- en las dos monedas — correcto para UYU/USD/ARS/EUR entre sí, silenciosamente
-- mal para cualquier par con JPY/CLP (0 decimales) o cripto (8). Se corrige
-- acá y de paso alcanza a la conversión que ya existía.
-- ============================================================================

CREATE FUNCTION public.currency_decimals(p_code text)
RETURNS smallint
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT COALESCE((SELECT c.decimals FROM public.currencies c WHERE c.code = p_code), 2);
$$;

CREATE FUNCTION public.convert_minor(p_amount bigint, p_rate numeric, p_from_decimals smallint, p_to_decimals smallint)
RETURNS bigint
LANGUAGE sql IMMUTABLE
AS $$
  SELECT round(p_amount * p_rate * power(10, p_to_decimals - p_from_decimals))::bigint;
$$;

-- ============================================================================
-- Reescritura del materializador.
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
      v_last_processed := v_day;

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

        v_original_amount := r.expected_amount;
        v_original_currency := r.currency_code;
        v_original_rate := v_capture_rate;

        IF v_capture_rate IS NULL THEN
          -- Nunca se reinterpreta el número pactado como si ya estuviera
          -- en la moneda de la cuenta — mismo criterio A3 de la captura
          -- normal (`save-transaction.ts`). `needs_capture_fx` lo marca solo.
          v_amount := 0;
        ELSE
          v_amount := public.convert_minor(
            r.expected_amount, v_capture_rate,
            public.currency_decimals(r.currency_code), public.currency_decimals(r.account_currency_code)
          );
        END IF;
      END IF;

      -- Segunda conversión — cuenta → base. Ya existía; ahora parte del
      -- monto YA convertido (`v_amount`/`r.account_currency_code`), no de
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
