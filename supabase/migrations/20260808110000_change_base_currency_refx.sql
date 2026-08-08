-- Cambiar la moneda base de un household (Más → Ajustes → Moneda base,
-- `src/app/(app)/more/settings/page.tsx`) reescribía `households.base_currency`
-- sin tocar un solo `amount_base` — todo el histórico quedaba congelado
-- contra la base VIEJA pero rotulado con la nueva, y todos los agregados
-- (patrimonio, presupuestos, análisis) empezaban a leer y mostrar esos
-- números como si fueran de la base nueva. Corrupción silenciosa, sin un
-- solo error visible.
--
-- La regla cerrada es "un `fx_rate` resuelto nunca se recalcula, ni en un
-- backfill, ni al corregir la cotización del día" (CLAUDE.md) — y el código
-- ya la hace cumplir al pie de la letra: `resolvePendingFx()`
-- (`src/features/movements/resolve-pending-fx.ts`) se niega literalmente a
-- pisar un `fxRate` no nulo. Recalcular en el lugar contra el par nuevo
-- rompería exactamente esa regla. Lo que SÍ respeta la regla — y es la
-- decisión tomada para esta migración — es DESCARTAR el rate viejo en vez
-- de inventar uno nuevo: los movimientos ya resueltos contra la base vieja
-- vuelven a `pending` (fx_rate/amount_base → NULL), entrando al mismo
-- flujo de resolución que cualquier `needs_fx` legítimo (E8, manual). Nunca
-- se escribe un valor calculado sobre uno congelado — se lo vacía primero.
--
-- Única excepción, y no es una invención: un movimiento cuya `currency_code`
-- YA ES la nueva base tiene una conversión exacta y trivial (rate = 1,
-- amount_base = amount) — no es un rate "adivinado", es la identidad
-- matemática de una moneda contra sí misma, la misma que ya usa
-- `resolveFxRate()` client-side cuando `base === quote`. Esto alcanza
-- también a un movimiento que hoy está `pending`: si su moneda ya es la
-- base nueva, se resuelve gratis a identidad — sigue siendo la transición
-- legítima "pending → resuelto" (CLAUDE.md), solo que la dispara el cambio
-- de base en vez de E8/manual.
--
-- Alcance: `transactions` (+ sus hijos `transaction_splits`/
-- `transaction_shares`, que llevan su propio `fx_source` desde
-- 20260801140000) y `settlements` ("una liquidación en moneda distinta de
-- la base es un agregado como cualquier otro" — 20260801011100:18).
-- `trades`/`portfolios` quedan AFUERA a propósito: `portfolios.base_currency`
-- es un campo propio, independiente de `households.base_currency`
-- (20260801011010:17) — cambiar la moneda base del household no toca
-- inversiones, no hay nada que resolver ahí.
--
-- Los hijos se tocan A MANO, sin depender de ningún trigger existente:
-- `inherit_fx_state_splits/shares` (BEFORE UPDATE) solo corre cuando la fila
-- del HIJO se actualiza, y `propagate_fx_resolution_to_children` (AFTER
-- UPDATE ON transactions) solo propaga hijos que siguen en `fx_source =
-- 'pending'` — ninguno de los dos cubre "el padre vuelve de resuelto a
-- pending", que es exactamente lo que hace esta función y no existía antes.
-- Por eso acá se hace un UPDATE explícito de cada hijo DESPUÉS de actualizar
-- el padre: el `UPDATE` en sí dispara `inherit_fx_state_*`, que lee el
-- estado YA nuevo del padre y deriva `fx_source`/`amount_base` correctos —
-- este código no calcula esos valores, solo obliga a que el trigger corra.

CREATE FUNCTION public.change_household_base_currency(p_household_id uuid, p_new_base_currency text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_base text;
  v_identity_count bigint := 0;
  v_reset_count bigint := 0;
  v_settlements_identity bigint := 0;
  v_settlements_reset bigint := 0;
BEGIN
  -- SECURITY DEFINER bypassea RLS: la validación de permiso vive acá,
  -- primero de todo, misma disciplina que `purge_household_step`.
  IF NOT public.is_household_admin(p_household_id) THEN
    RAISE EXCEPTION 'Solo un admin del household puede cambiar la moneda base'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  SELECT base_currency INTO v_old_base FROM public.households WHERE id = p_household_id AND deleted_at IS NULL;
  IF v_old_base IS NULL THEN
    RAISE EXCEPTION 'Household no encontrado' USING ERRCODE = '02000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.currencies WHERE code = p_new_base_currency AND is_active) THEN
    RAISE EXCEPTION 'Moneda inválida: %', p_new_base_currency USING ERRCODE = '22023';
  END IF;

  IF v_old_base = p_new_base_currency THEN
    RETURN jsonb_build_object('changed', false, 'identityCount', 0, 'resetCount', 0, 'settlementsIdentityCount', 0, 'settlementsResetCount', 0);
  END IF;

  -- transactions cuya currency_code ya es la base nueva: identidad exacta.
  -- `updated_at`/`client_rev` se bumpean a mano — a diferencia de otras
  -- tablas, `transactions` no tiene trigger que lo haga sola, y
  -- `pullFromRemote()` usa `updated_at` como cursor incremental (único
  -- camino por el que Dexie se entera de este cambio, porque esta función
  -- escribe directo por SQL, nunca por el outbox del cliente).
  WITH touched AS (
    UPDATE public.transactions
    SET fx_rate = 1, fx_source = 'identity', fx_provider = NULL, fx_quote_kind = NULL,
        fx_resolved_at = now(), amount_base = amount, updated_at = now(), client_rev = client_rev + 1
    WHERE household_id = p_household_id AND deleted_at IS NULL
      AND currency_code = p_new_base_currency
      AND (fx_rate IS DISTINCT FROM 1 OR fx_source <> 'identity' OR amount_base IS DISTINCT FROM amount)
    RETURNING id
  )
  SELECT count(*) INTO v_identity_count FROM touched;

  -- El WHERE filtra por AMBOS (valor Y fx_source) — no alcanza con mirar
  -- `amount_base`: un hijo puede tener por casualidad `amount_base = amount`
  -- de un estado viejo (`inherited`, `manual`) y quedar con el `fx_source`
  -- equivocado si solo se mira el valor.
  UPDATE public.transaction_splits s
  SET amount_base = s.amount
  FROM public.transactions t
  WHERE s.transaction_id = t.id AND s.deleted_at IS NULL
    AND t.household_id = p_household_id AND t.deleted_at IS NULL
    AND t.currency_code = p_new_base_currency AND t.fx_rate = 1 AND t.fx_source = 'identity'
    AND (s.amount_base IS DISTINCT FROM s.amount OR s.fx_source <> 'identity');

  UPDATE public.transaction_shares sh
  SET share_amount_base = sh.share_amount
  FROM public.transactions t
  WHERE sh.transaction_id = t.id AND sh.deleted_at IS NULL
    AND t.household_id = p_household_id AND t.deleted_at IS NULL
    AND t.currency_code = p_new_base_currency AND t.fx_rate = 1 AND t.fx_source = 'identity'
    AND (sh.share_amount_base IS DISTINCT FROM sh.share_amount OR sh.fx_source <> 'identity');

  -- El resto de las YA resueltas contra la base vieja: se descartan, vuelven
  -- a pending. Nunca se recalculan — se vacían primero.
  WITH touched AS (
    UPDATE public.transactions
    SET fx_rate = NULL, fx_source = 'pending', fx_provider = NULL, fx_quote_kind = NULL,
        fx_resolved_at = NULL, amount_base = NULL, updated_at = now(), client_rev = client_rev + 1
    WHERE household_id = p_household_id AND deleted_at IS NULL
      AND currency_code <> p_new_base_currency
      AND fx_rate IS NOT NULL
    RETURNING id
  )
  SELECT count(*) INTO v_reset_count FROM touched;

  UPDATE public.transaction_splits s
  SET amount_base = NULL
  FROM public.transactions t
  WHERE s.transaction_id = t.id AND s.deleted_at IS NULL
    AND t.household_id = p_household_id AND t.deleted_at IS NULL
    AND t.fx_rate IS NULL
    AND (s.amount_base IS NOT NULL OR s.fx_source <> 'pending');

  UPDATE public.transaction_shares sh
  SET share_amount_base = NULL
  FROM public.transactions t
  WHERE sh.transaction_id = t.id AND sh.deleted_at IS NULL
    AND t.household_id = p_household_id AND t.deleted_at IS NULL
    AND t.fx_rate IS NULL
    AND (sh.share_amount_base IS NOT NULL OR sh.fx_source <> 'pending');

  -- settlements: mismo criterio, sin hijos.
  WITH touched AS (
    UPDATE public.settlements
    SET fx_rate = 1, fx_source = 'identity', amount_base = amount, updated_at = now()
    WHERE household_id = p_household_id AND deleted_at IS NULL
      AND currency_code = p_new_base_currency
      AND (fx_rate IS DISTINCT FROM 1 OR fx_source <> 'identity' OR amount_base IS DISTINCT FROM amount)
    RETURNING id
  )
  SELECT count(*) INTO v_settlements_identity FROM touched;

  WITH touched AS (
    UPDATE public.settlements
    SET fx_rate = NULL, fx_source = 'pending', amount_base = NULL, updated_at = now()
    WHERE household_id = p_household_id AND deleted_at IS NULL
      AND currency_code <> p_new_base_currency
      AND fx_rate IS NOT NULL
    RETURNING id
  )
  SELECT count(*) INTO v_settlements_reset FROM touched;

  UPDATE public.households SET base_currency = p_new_base_currency, updated_at = now() WHERE id = p_household_id;

  INSERT INTO public.audit_log (household_id, actor_id, entity, entity_id, action, diff)
  VALUES (
    p_household_id, (SELECT auth.uid()), 'households', p_household_id, 'base_currency_changed',
    jsonb_build_object(
      'from', v_old_base, 'to', p_new_base_currency,
      'transactionsIdentity', v_identity_count, 'transactionsReset', v_reset_count,
      'settlementsIdentity', v_settlements_identity, 'settlementsReset', v_settlements_reset
    )
  );

  RETURN jsonb_build_object(
    'changed', true,
    'identityCount', v_identity_count,
    'resetCount', v_reset_count,
    'settlementsIdentityCount', v_settlements_identity,
    'settlementsResetCount', v_settlements_reset
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.change_household_base_currency(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_household_base_currency(uuid, text) TO authenticated;

-- Read-only: mismos conteos que la función de arriba, sin escribir nada.
-- El Sheet de "Moneda base" (K3) lo llama antes de confirmar — "cambiar la
-- moneda base" es la excepción a "reversible, no confirmable" (misma que
-- sacar a un miembro del hogar), así que confirma con números reales, no
-- con una advertencia genérica.
CREATE FUNCTION public.preflight_change_base_currency(p_household_id uuid, p_new_base_currency text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_base text;
  v_identity_count bigint;
  v_reset_count bigint;
  v_settlements_identity bigint;
  v_settlements_reset bigint;
BEGIN
  IF NOT public.is_household_admin(p_household_id) THEN
    RAISE EXCEPTION 'Solo un admin del household puede cambiar la moneda base'
      USING ERRCODE = '42501';
  END IF;

  SELECT base_currency INTO v_old_base FROM public.households WHERE id = p_household_id AND deleted_at IS NULL;
  IF v_old_base IS NULL THEN
    RAISE EXCEPTION 'Household no encontrado' USING ERRCODE = '02000';
  END IF;

  IF v_old_base = p_new_base_currency THEN
    RETURN jsonb_build_object('changed', false, 'identityCount', 0, 'resetCount', 0, 'settlementsIdentityCount', 0, 'settlementsResetCount', 0);
  END IF;

  SELECT count(*) INTO v_identity_count FROM public.transactions
  WHERE household_id = p_household_id AND deleted_at IS NULL
    AND currency_code = p_new_base_currency
    AND (fx_rate IS DISTINCT FROM 1 OR fx_source <> 'identity' OR amount_base IS DISTINCT FROM amount);

  SELECT count(*) INTO v_reset_count FROM public.transactions
  WHERE household_id = p_household_id AND deleted_at IS NULL
    AND currency_code <> p_new_base_currency AND fx_rate IS NOT NULL;

  SELECT count(*) INTO v_settlements_identity FROM public.settlements
  WHERE household_id = p_household_id AND deleted_at IS NULL
    AND currency_code = p_new_base_currency
    AND (fx_rate IS DISTINCT FROM 1 OR fx_source <> 'identity' OR amount_base IS DISTINCT FROM amount);

  SELECT count(*) INTO v_settlements_reset FROM public.settlements
  WHERE household_id = p_household_id AND deleted_at IS NULL
    AND currency_code <> p_new_base_currency AND fx_rate IS NOT NULL;

  RETURN jsonb_build_object(
    'changed', true,
    'identityCount', v_identity_count,
    'resetCount', v_reset_count,
    'settlementsIdentityCount', v_settlements_identity,
    'settlementsResetCount', v_settlements_reset
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.preflight_change_base_currency(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preflight_change_base_currency(uuid, text) TO authenticated;
