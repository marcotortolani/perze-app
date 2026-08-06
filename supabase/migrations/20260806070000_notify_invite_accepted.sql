-- El owner de un household solo se enteraba de que alguien aceptó su
-- invitación abriendo Grupo familiar a mano — mismo hueco que ya se
-- cerró para "nueva solicitud de acceso" (`20260806010000_notify_admin_on_signup.sql`),
-- ahora para el otro lado del flujo de invitación. Mismo patrón: trigger
-- de Postgres, Vault para las credenciales (`perze_project_url`/
-- `perze_service_role_key`), sale en silencio sin ellas — nunca bloquea
-- el `accept_invite()` real.

CREATE OR REPLACE FUNCTION public.notify_invite_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_url text;
  v_service_key text;
BEGIN
  IF NEW.accepted_by IS NOT NULL AND OLD.accepted_by IS NULL THEN
    SELECT decrypted_secret INTO v_project_url FROM vault.decrypted_secrets WHERE name = 'perze_project_url';
    SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'perze_service_role_key';
    IF v_project_url IS NOT NULL AND v_service_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_project_url || '/functions/v1/notify-invite-accepted',
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key, 'Content-Type', 'application/json'),
        body := jsonb_build_object('householdId', NEW.household_id, 'newMemberId', NEW.accepted_by)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS household_invites_notify_accepted ON public.household_invites;
CREATE TRIGGER household_invites_notify_accepted
AFTER UPDATE OF accepted_by ON public.household_invites
FOR EACH ROW
EXECUTE FUNCTION public.notify_invite_accepted();
