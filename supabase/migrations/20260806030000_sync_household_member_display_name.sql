-- Bug real reportado en vivo: un miembro invitado se unía correctamente
-- (accept_invite() insertaba la fila de household_members) pero quedaba
-- "Unnamed" para siempre en J1 del owner, y renombrarse desde
-- /more/profile tampoco lo corregía.
--
-- household_members.display_name es una copia denormalizada a propósito
-- (ver complete-onboarding.ts: el resto del hogar no tiene el perfil de
-- cada miembro en su Dexie local) pero nada la mantenía sincronizada
-- después del insert inicial:
--   1. accept_invite() insertaba la fila SIN display_name (quedaba NULL).
--   2. Ningún trigger propagaba un rename posterior de profiles.display_name
--      a las filas de household_members de los households donde el usuario
--      participa (ni siquiera al owner que se renombra a sí mismo).
--
-- Se cierran los dos: accept_invite() puebla display_name al aceptar, y un
-- trigger AFTER UPDATE en profiles la mantiene sincronizada para siempre.
-- Backfill al final para las filas que ya quedaron desincronizadas en
-- producción (incluida la de este reporte).

CREATE OR REPLACE FUNCTION public.sync_household_member_display_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.household_members
  SET display_name = NEW.display_name
  WHERE profile_id = NEW.id
    AND display_name IS DISTINCT FROM NEW.display_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_household_member_display_name ON public.profiles;
CREATE TRIGGER profiles_sync_household_member_display_name
AFTER UPDATE OF display_name ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_household_member_display_name();

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

  INSERT INTO public.household_members (household_id, profile_id, role, display_name, status, joined_at)
  VALUES (v_invite.household_id, v_uid, v_invite.role, v_display_name, 'active', now())
  ON CONFLICT (household_id, profile_id) DO NOTHING;

  UPDATE public.household_invites SET accepted_by = v_uid WHERE id = v_invite.id;

  RETURN v_invite.household_id;
END;
$$;

UPDATE public.household_members hm
SET display_name = p.display_name
FROM public.profiles p
WHERE p.id = hm.profile_id
  AND hm.display_name IS DISTINCT FROM p.display_name;
