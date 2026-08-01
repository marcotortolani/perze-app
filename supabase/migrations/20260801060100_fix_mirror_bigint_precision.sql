-- Corrige `20260801060000_mirror_mode.sql`: `RETURNS SETOF public.accounts`
-- / `SETOF public.transactions` deja que PostgREST serialice `bigint`
-- (amount, current_balance, etc.) como JSON number — exactamente el
-- redondeo silencioso a `number` que CLAUDE.md prohíbe para plata. Se
-- reescriben con `RETURNS TABLE(...)` explícito, casteando cada bigint a
-- `text` (mismo patrón que `/api/fx`), y de paso solo exponen las columnas
-- que el cliente de espejo realmente necesita.

DROP FUNCTION IF EXISTS public.mirror_accounts(uuid, uuid);
DROP FUNCTION IF EXISTS public.mirror_transactions(uuid, uuid);

CREATE FUNCTION public.mirror_accounts(p_household_id uuid, p_target_member uuid)
RETURNS TABLE (
  id uuid,
  name text,
  kind text,
  currency_code text,
  current_balance text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_can_mirror(p_household_id, p_target_member);

  RETURN QUERY
  SELECT a.id, a.name, a.kind, a.currency_code, a.current_balance::text
  FROM public.accounts a
  WHERE a.household_id = p_household_id
    AND a.deleted_at IS NULL
    AND public.can_see_as('account', a.id, a.visibility, a.owner_id, p_target_member);
END;
$$;

CREATE FUNCTION public.mirror_transactions(p_household_id uuid, p_target_member uuid)
RETURNS TABLE (
  id uuid,
  account_id uuid,
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
  SELECT t.id, t.account_id, t.kind, t.amount::text, t.currency_code, t.occurred_at, t.note
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
