-- Bug real reportado en vivo, segunda mitad del mismo caso: remover a un
-- miembro (`markHouseholdMemberFormer`, status -> 'former') y volver a
-- invitarlo con un código nuevo parecía funcionar —`accept_invite()`
-- marcaba la invitación como aceptada sin error— pero la fila de
-- `household_members` nunca volvía a `active`: el `INSERT ... ON CONFLICT
-- (household_id, profile_id) DO NOTHING` no hacía nada porque la fila
-- 'former' ya existía, así que quien se fue quedaba sin forma real de
-- volver a entrar aunque la app dijera que sí.
--
-- `DO UPDATE` reactiva la fila existente en vez de no hacer nada: vuelve a
-- 'active', limpia `left_at`, y toma el rol/nombre actuales (por si cambió
-- el rol de la invitación nueva, o el display_name desde la última vez).

CREATE OR REPLACE FUNCTION public.accept_invite(invite_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite public.household_invites;
  v_uid uuid := (SELECT auth.uid());
  v_email text;
  v_display_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa';
  END IF;

  SELECT * INTO v_invite FROM public.household_invites
  WHERE code = invite_code
    AND accepted_by IS NULL
    AND revoked_at IS NULL
    AND expires_at > now();

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invitación inválida o vencida';
  END IF;

  IF v_invite.email IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    IF v_email IS NULL OR lower(v_email) <> lower(v_invite.email) THEN
      RAISE EXCEPTION 'Esta invitación es para otra cuenta';
    END IF;
  END IF;

  SELECT display_name INTO v_display_name FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.household_members (household_id, profile_id, role, display_name, status, joined_at, left_at)
  VALUES (v_invite.household_id, v_uid, v_invite.role, v_display_name, 'active', now(), NULL)
  ON CONFLICT (household_id, profile_id) DO UPDATE
  SET status = 'active',
      role = EXCLUDED.role,
      display_name = EXCLUDED.display_name,
      joined_at = now(),
      left_at = NULL;

  UPDATE public.household_invites SET accepted_by = v_uid WHERE id = v_invite.id;

  RETURN v_invite.household_id;
END;
$$;
