-- Lado de LECTURA del resumen por mail (`docs/resumen-mensual-por-mail.md`).
-- Las llama la Edge Function `monthly-summary` con `service_role`, nunca el
-- cliente. No calculan el resumen: devuelven las filas que ESE miembro
-- puede ver, y el resumen lo arma `buildMonthlySummary()` en TypeScript
-- (`src/lib/analytics/monthly-summary.ts`) — la regla de signo por `kind` y
-- la exclusión de `needs_fx` no se duplican acá.
--
-- La única excepción es `summary_account_balances`: reconstruir un saldo
-- exige TODA la historia de la cuenta, así que en TypeScript el payload
-- crecería con los años de uso. Se agrega en SQL y viaja un número por
-- cuenta. Eso le da a la regla de "qué cuenta mueve cada `kind` y por
-- cuánto" un segundo lugar donde vive, espejo de
-- `computeTransactionEffects()` (`src/lib/repos/balance-effects.ts`): si
-- una cambia, la otra también. `supabase/tests/database/28_monthly_summary.sql`
-- fija esa equivalencia.
--
-- **El filtro de visibilidad es el mismo predicado del `tx_select` de RLS**
-- (`20260801020000_fix_soft_delete_rls.sql`), con `can_see_as` en lugar de
-- `can_see` para poder preguntar "¿qué ve Ana?" sin ser Ana. Si acá se
-- afloja, el mail filtra por correo justo lo que la app oculta en pantalla:
-- es el modo de falla más caro de esta funcionalidad.

-- Si `p_viewer` no es miembro activo del hogar, las dos funciones devuelven
-- CERO filas en vez de fallar. Es deliberado: un cron que quedó con un
-- miembro viejo produce "no hubo actividad" y no se manda mail, que es
-- infinitamente mejor que mandarle el resumen de un hogar al que ya no
-- pertenece.

CREATE FUNCTION public.summary_transactions(
  p_household_id uuid,
  p_viewer uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (
  kind text,
  amount_base text, -- bigint como text: en JSON perdería precisión
  occurred_at timestamptz,
  category_id uuid,
  category_name text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    t.kind,
    t.amount_base::text,
    t.occurred_at,
    t.category_id,
    -- El nombre solo si ese miembro puede ver la categoría. El movimiento
    -- cuenta igual en los totales; lo que no viaja es el nombre.
    (
      SELECT c.name FROM public.categories c
      WHERE c.id = t.category_id
        AND public.can_see_as('category', c.id, c.visibility, c.owner_id, p_viewer)
    )
  FROM public.transactions t
  WHERE t.household_id = p_household_id
    AND t.deleted_at IS NULL
    AND t.occurred_at >= p_from
    AND t.occurred_at < p_to
    AND (t.visibility = 'household' OR t.created_by = p_viewer)
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = t.account_id
        AND public.can_see_as('account', a.id, a.visibility, a.owner_id, p_viewer)
    )
    AND EXISTS (
      SELECT 1 FROM public.household_members m
      WHERE m.household_id = p_household_id AND m.profile_id = p_viewer AND m.status = 'active'
    );
$$;

CREATE FUNCTION public.summary_account_balances(
  p_household_id uuid,
  p_viewer uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (
  account_id uuid,
  name text,
  currency_code text,
  opening text,
  closing text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  WITH viewer AS (
    SELECT 1 FROM public.household_members m
    WHERE m.household_id = p_household_id AND m.profile_id = p_viewer AND m.status = 'active'
  ),
  visible_accounts AS (
    SELECT a.id, a.name, a.currency_code, a.opening_balance, a.opening_date
    FROM public.accounts a
    WHERE a.household_id = p_household_id
      AND a.deleted_at IS NULL
      AND a.archived_at IS NULL -- igual que `periodAccountBalances()`
      AND EXISTS (SELECT 1 FROM viewer)
      AND public.can_see_as('account', a.id, a.visibility, a.owner_id, p_viewer)
  ),
  visible_tx AS (
    SELECT t.kind, t.amount, t.account_id, t.counter_account_id, t.counter_amount, t.occurred_at
    FROM public.transactions t
    WHERE t.household_id = p_household_id
      AND t.deleted_at IS NULL
      AND t.occurred_at < p_to
      AND (t.visibility = 'household' OR t.created_by = p_viewer)
      AND EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.id = t.account_id
          AND public.can_see_as('account', a.id, a.visibility, a.owner_id, p_viewer)
      )
  ),
  -- Espejo exacto de `computeTransactionEffects()`: expense y la pata
  -- origen de transfer restan; income, adjustment e investing suman con el
  -- signo que ya trae `amount`; la pata destino de transfer suma
  -- `counter_amount` cuando la transferencia cruza monedas.
  effects AS (
    SELECT t.account_id, t.occurred_at,
      CASE WHEN t.kind IN ('expense', 'transfer') THEN -t.amount ELSE t.amount END AS delta
    FROM visible_tx t
    UNION ALL
    SELECT t.counter_account_id, t.occurred_at, COALESCE(t.counter_amount, t.amount)
    FROM visible_tx t
    WHERE t.kind = 'transfer' AND t.counter_account_id IS NOT NULL
  )
  SELECT
    va.id,
    va.name,
    va.currency_code,
    -- Antes de `opening_date` la cuenta no existía: 0, no `opening_balance`
    -- (misma distinción que `accountBalanceAt()` y D66b). El corte es en
    -- UTC porque la comparación equivalente de TypeScript es entre strings
    -- ISO, que son UTC.
    (CASE
      WHEN va.opening_date IS NOT NULL AND (p_from AT TIME ZONE 'UTC')::date < va.opening_date THEN 0
      ELSE va.opening_balance
        + COALESCE((SELECT sum(e.delta) FROM effects e WHERE e.account_id = va.id AND e.occurred_at < p_from), 0)
    END)::bigint::text,
    (CASE
      WHEN va.opening_date IS NOT NULL AND (p_to AT TIME ZONE 'UTC')::date < va.opening_date THEN 0
      ELSE va.opening_balance
        + COALESCE((SELECT sum(e.delta) FROM effects e WHERE e.account_id = va.id AND e.occurred_at < p_to), 0)
    END)::bigint::text
  FROM visible_accounts va
  ORDER BY va.name;
$$;

-- Las dos toman un `p_viewer` arbitrario: si `authenticated` pudiera
-- ejecutarlas, cualquier miembro leería lo privado de cualquier otro. Es el
-- mismo motivo por el que `can_see_as` está envuelta en `mirror_*` con
-- `assert_can_mirror` — acá el envoltorio es el privilegio.
REVOKE EXECUTE ON FUNCTION public.summary_transactions(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.summary_account_balances(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.summary_transactions(uuid, uuid, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.summary_account_balances(uuid, uuid, timestamptz, timestamptz) TO service_role;
