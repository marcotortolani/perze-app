-- Hoy todos los miembros de un household comparten el mismo ícono
-- genérico ("users") en la lista de Familia, y un movimiento no dice
-- quién lo cargó — con más de una persona en el hogar no hay forma de
-- diferenciar de un vistazo quién hizo qué. `icon` es la identidad
-- elegida por la persona (nombre de `IconName`, el mismo set que usa
-- `<Icon name="..." />` en el cliente — Phosphor), vive en `profiles`
-- igual que `display_name` (es la cuenta, no algo por-household).
--
-- Mismo problema de visibilidad que `display_name`: `profiles_select` es
-- self-only (`id = auth.uid()`), así que el resto del household nunca
-- puede leer `profiles.icon` de otro miembro directamente. Se sincroniza
-- a `household_members.icon` (la copia denormalizada que sí pueden leer
-- los demás) con el mismo trigger que ya sincroniza `display_name`
-- (`20260806030000_sync_household_member_display_name.sql`) — generalizado
-- acá para cubrir las dos columnas en vez de duplicar un segundo trigger
-- casi idéntico.
ALTER TABLE public.profiles ADD COLUMN icon text NOT NULL DEFAULT 'user';
ALTER TABLE public.household_members ADD COLUMN icon text NOT NULL DEFAULT 'user';

CREATE OR REPLACE FUNCTION public.sync_household_member_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.household_members
  SET display_name = NEW.display_name, icon = NEW.icon
  WHERE profile_id = NEW.id
    AND (display_name IS DISTINCT FROM NEW.display_name OR icon IS DISTINCT FROM NEW.icon);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_household_member_display_name ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_household_member_display_name();
CREATE TRIGGER profiles_sync_household_member_identity
AFTER UPDATE OF display_name, icon ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_household_member_identity();

-- `accept_invite()` puebla display_name al aceptar (ver migración de
-- origen) — ahora también icon, mismo criterio.
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
  v_icon text;
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

  SELECT display_name, icon INTO v_display_name, v_icon FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.household_members (household_id, profile_id, role, display_name, icon, status, joined_at)
  VALUES (v_invite.household_id, v_uid, v_invite.role, v_display_name, coalesce(v_icon, 'user'), 'active', now())
  ON CONFLICT (household_id, profile_id) DO NOTHING;

  UPDATE public.household_invites SET accepted_by = v_uid WHERE id = v_invite.id;

  RETURN v_invite.household_id;
END;
$$;

-- Backfill: filas de household_members ya existentes toman el icon actual del perfil.
UPDATE public.household_members hm
SET icon = p.icon
FROM public.profiles p
WHERE p.id = hm.profile_id
  AND hm.icon IS DISTINCT FROM p.icon;
