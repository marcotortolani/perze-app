-- D35 — dos huecos reales en push (K12): recibir una invitación y que
-- alguien se una al hogar solo avisaban por mail, nunca por push, aunque
-- toda la infraestructura de envío (`send-push`) ya existe. Los dos casos
-- necesitan un modelo de destinatario que `notification_preferences`
-- (household_id + profile_id) no cubre:
--   - "Te invitaron" es ANTES de ser miembro del household — no hay fila
--     de preferencia posible ahí, `notification_preferences` es por
--     household y todavía no perteneces a ninguno para este caso.
--   - "Nueva versión disponible" (agregado acá también, mismo motivo) es
--     independiente de cualquier household — es de la cuenta, no del hogar.
-- `profile_notification_preferences` es la contraparte por-perfil de
-- `notification_preferences`, para justo estos dos casos.

CREATE TABLE public.profile_notification_preferences (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles (id),
  invite_received boolean NOT NULL DEFAULT true,
  app_updates boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY profile_notification_preferences_all ON public.profile_notification_preferences FOR ALL
USING (profile_id = (SELECT auth.uid()))
WITH CHECK (profile_id = (SELECT auth.uid()));

CREATE TRIGGER profile_notification_preferences_immutable BEFORE UPDATE ON public.profile_notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('profile_id');

-- "Alguien se unió a tu hogar" SÍ es un caso household-scoped normal
-- (el destinatario ya es miembro — owner/admin) — mismo mecanismo que
-- `budget_alerts`/etc, solo falta la columna.
ALTER TABLE public.notification_preferences
  ADD COLUMN household_joined boolean NOT NULL DEFAULT true;

-- Reemplaza `notify_invite_accepted()` (20260806070000): mismo trigger de
-- siempre (dispara el mail), suma una segunda llamada a `send-push` con
-- los mismos destinatarios (owner/admin activos, sin el que se acaba de
-- unir) que ya calculaba `notify-invite-accepted` — se recalculan acá
-- porque el push sale de esta función SQL, no de la Edge Function del
-- mail, para no duplicar la resolución de nombres en dos lenguajes.
CREATE OR REPLACE FUNCTION public.notify_invite_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_url text;
  v_service_key text;
  v_household_name text;
  v_member_name text;
  v_recipient_ids uuid[];
BEGIN
  IF NEW.accepted_by IS NOT NULL AND OLD.accepted_by IS NULL THEN
    SELECT decrypted_secret INTO v_project_url FROM vault.decrypted_secrets WHERE name = 'perze_project_url';
    SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'perze_service_role_key';
    IF v_project_url IS NOT NULL AND v_service_key IS NOT NULL THEN
      -- Mail al owner/admin (comportamiento de siempre).
      PERFORM net.http_post(
        url := v_project_url || '/functions/v1/notify-invite-accepted',
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key, 'Content-Type', 'application/json'),
        body := jsonb_build_object('householdId', NEW.household_id, 'newMemberId', NEW.accepted_by)
      );

      -- Push a los mismos destinatarios — activos, owner/admin, sin el
      -- que se acaba de unir. `send-push` filtra igual por
      -- `notification_preferences.household_joined` de cada uno.
      SELECT array_agg(hm.profile_id) INTO v_recipient_ids
      FROM public.household_members hm
      WHERE hm.household_id = NEW.household_id AND hm.status = 'active' AND hm.role IN ('owner', 'admin') AND hm.profile_id <> NEW.accepted_by;

      IF v_recipient_ids IS NOT NULL AND array_length(v_recipient_ids, 1) > 0 THEN
        SELECT name INTO v_household_name FROM public.households WHERE id = NEW.household_id;
        SELECT COALESCE(NULLIF(TRIM(display_name), ''), 'Alguien') INTO v_member_name FROM public.profiles WHERE id = NEW.accepted_by;

        PERFORM net.http_post(
          url := v_project_url || '/functions/v1/send-push',
          headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key, 'Content-Type', 'application/json'),
          body := jsonb_build_object(
            'householdId', NEW.household_id,
            'profileIds', to_jsonb(v_recipient_ids),
            'kind', 'household_joined',
            'title', 'Nuevo miembro en tu hogar',
            'body', v_member_name || ' se unió a "' || COALESCE(v_household_name, 'tu hogar') || '"',
            'url', '/family'
          )
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- "Te invitaron" — el destinatario TODAVÍA no es miembro de nada, así que
-- no hay `notification_preferences` que consultar. Solo dispara si el
-- mail de la invitación coincide con una cuenta YA existente (nadie
-- recibe un push sin haberse registrado antes) — `auth.users` se puede
-- consultar directo desde una función `SECURITY DEFINER`, no hace falta
-- pasar por una Edge Function para esta resolución.
CREATE OR REPLACE FUNCTION public.notify_invite_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_url text;
  v_service_key text;
  v_recipient_id uuid;
  v_household_name text;
  v_inviter_name text;
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_recipient_id FROM auth.users WHERE lower(email) = lower(NEW.email) LIMIT 1;
  IF v_recipient_id IS NULL THEN
    RETURN NEW; -- todavía no tiene cuenta — nada que empujarle, el mail sigue siendo el camino
  END IF;

  SELECT decrypted_secret INTO v_project_url FROM vault.decrypted_secrets WHERE name = 'perze_project_url';
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'perze_service_role_key';
  IF v_project_url IS NULL OR v_service_key IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_household_name FROM public.households WHERE id = NEW.household_id;
  SELECT COALESCE(NULLIF(TRIM(display_name), ''), 'Alguien') INTO v_inviter_name FROM public.profiles WHERE id = NEW.invited_by;

  PERFORM net.http_post(
    url := v_project_url || '/functions/v1/send-push',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'profileIds', to_jsonb(ARRAY[v_recipient_id]),
      'kind', 'household_invite',
      'title', 'Te invitaron a un hogar en PERZE',
      'body', v_inviter_name || ' te invitó a "' || COALESCE(v_household_name, 'un hogar') || '"',
      'url', ('/join?invite=' || NEW.code)
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS household_invites_notify_created ON public.household_invites;
CREATE TRIGGER household_invites_notify_created
AFTER INSERT ON public.household_invites
FOR EACH ROW
EXECUTE FUNCTION public.notify_invite_created();
