-- `mirror_transactions()` (redefinida por `20260801060100_fix_mirror_bigint_precision.sql`
-- con un `RETURNS TABLE` explícito de 7 columnas, sin `counter_account_id`) no
-- traía el dato necesario para distinguir un pago de tarjeta de una
-- transferencia genérica en el modo espejo (`/family/mirror/[memberId]`).
-- `mirror-repo.ts` había asumido —incorrectamente, por leer solo la
-- migración original `20260801060000_mirror_mode.sql`, que sí hacía
-- `SELECT t.*`— que la columna ya viajaba, y castea el tipo generado a
-- mano como parche temporal. Esta migración cierra la brecha real: agrega
-- la columna a la función. `counter_account_id` es un `uuid`, no plata —
-- no necesita el cast a `text` que sí llevan `amount`/`current_balance`
-- (bigint → number sería el problema que esa migración resolvía).

DROP FUNCTION IF EXISTS public.mirror_transactions(uuid, uuid);

CREATE FUNCTION public.mirror_transactions(p_household_id uuid, p_target_member uuid)
RETURNS TABLE (
  id uuid,
  account_id uuid,
  counter_account_id uuid,
  kind text,
  amount text,
  currency_code text,
  occurred_at timestamptz,
  note text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_can_mirror(p_household_id, p_target_member);

  RETURN QUERY
  SELECT t.id, t.account_id, t.counter_account_id, t.kind, t.amount::text, t.currency_code, t.occurred_at, t.note
  FROM public.transactions t
  WHERE t.household_id = p_household_id
    AND t.deleted_at IS NULL
    AND (t.visibility = 'household' OR t.created_by = p_target_member)
    AND EXISTS (
      SELECT 1 FROM public.accounts a WHERE a.id = t.account_id
        AND public.can_see_as('account', a.id, a.visibility, a.owner_id, p_target_member)
    );
END;
$$;

-- `20260801120000_grants_and_revoke_definer_execute.sql` no toca
-- `mirror_transactions`/`mirror_accounts` (SECURITY DEFINER, se llaman vía
-- `supabase.rpc(...)` con la sesión del usuario) — no hace falta repetir
-- ningún GRANT/REVOKE acá, el `DROP`+`CREATE` no cambia esos privilegios.
