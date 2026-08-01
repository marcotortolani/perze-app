-- Bloque J4b (docs/plan-de-trabajo.md § 6.10). Modo espejo: "ver la app
-- como Ana" sin ampliar nunca el acceso del que mira. `can_see()` evalúa
-- siempre contra `auth.uid()` (el que está sentado en la sesión) — no
-- sirve para preguntar "¿qué vería Ana?" sin ser Ana. `can_see_as()` es la
-- misma lógica parametrizada por un `viewer_id` explícito.
--
-- Las funciones `mirror_accounts`/`mirror_transactions` son el único punto
-- donde eso se usa: primero verifican que quien llama Y el miembro
-- espejado sean los dos miembros ACTIVOS del mismo household — sin esa
-- verificación, cualquiera podría pedir "mirar como" un miembro de OTRO
-- household y ver datos ajenos.
CREATE FUNCTION public.can_see_as(p_type text, p_id uuid, p_visibility text, p_owner uuid, p_viewer uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE p_visibility
    WHEN 'household' THEN true
    WHEN 'private' THEN p_owner = p_viewer
    WHEN 'custom' THEN p_owner = p_viewer OR EXISTS (
      SELECT 1 FROM public.visibility_grants g
      WHERE g.subject_type = p_type AND g.subject_id = p_id
        AND g.member_id = p_viewer
        AND g.revoked_at IS NULL
    )
    ELSE false
  END;
$$;

CREATE FUNCTION public.assert_can_mirror(p_household_id uuid, p_target_member uuid)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_household_id AND profile_id = (SELECT auth.uid()) AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'No sos miembro activo de este household';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_household_id AND profile_id = p_target_member AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'El miembro espejado no pertenece a este household';
  END IF;
END;
$$;

CREATE FUNCTION public.mirror_accounts(p_household_id uuid, p_target_member uuid)
RETURNS SETOF public.accounts
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_can_mirror(p_household_id, p_target_member);

  RETURN QUERY
  SELECT a.* FROM public.accounts a
  WHERE a.household_id = p_household_id
    AND a.deleted_at IS NULL
    AND public.can_see_as('account', a.id, a.visibility, a.owner_id, p_target_member);
END;
$$;

CREATE FUNCTION public.mirror_transactions(p_household_id uuid, p_target_member uuid)
RETURNS SETOF public.transactions
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_can_mirror(p_household_id, p_target_member);

  RETURN QUERY
  SELECT t.* FROM public.transactions t
  WHERE t.household_id = p_household_id
    AND t.deleted_at IS NULL
    AND (t.visibility = 'household' OR t.created_by = p_target_member)
    AND EXISTS (
      SELECT 1 FROM public.accounts a WHERE a.id = t.account_id
        AND public.can_see_as('account', a.id, a.visibility, a.owner_id, p_target_member)
    );
END;
$$;
