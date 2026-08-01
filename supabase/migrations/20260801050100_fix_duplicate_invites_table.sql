-- Corrige `20260801050000_household_invites.sql`: creó una tabla `invites`
-- nueva sin chequear primero si ya existía una — y ya existía
-- (`household_invites`, en `20260801010200_identity.sql`, con `code` en
-- vez de `token` y `accepted_by` en vez de `accepted_at`). Exactamente el
-- error de "un documento, una copia" que CLAUDE.md pide evitar, aplicado a
-- schema en vez de a docs. Se tira la duplicada; `accept_invite()` se
-- reescribe contra la tabla real.

DROP FUNCTION IF EXISTS public.accept_invite(text);
DROP TABLE IF EXISTS public.invites;

-- SECURITY DEFINER: quien acepta todavía no es miembro del household, así
-- que no puede pasar la policy normal de `household_members_insert`.
CREATE FUNCTION public.accept_invite(invite_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite public.household_invites;
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa';
  END IF;

  SELECT * INTO v_invite FROM public.household_invites
  WHERE code = invite_code
    AND accepted_by IS NULL
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invitación inválida o vencida';
  END IF;

  INSERT INTO public.household_members (household_id, profile_id, role, status, joined_at)
  VALUES (v_invite.household_id, v_uid, v_invite.role, 'active', now())
  ON CONFLICT (household_id, profile_id) DO NOTHING;

  UPDATE public.household_invites SET accepted_by = v_uid WHERE id = v_invite.id;

  RETURN v_invite.household_id;
END;
$$;
