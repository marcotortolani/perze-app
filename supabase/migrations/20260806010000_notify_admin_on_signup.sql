-- Avisa por mail al operador cuando alguien nuevo se registra y su perfil
-- nace `access_status = 'pending'` — hasta acá la única forma de
-- enterarse era abrir la app y entrar a Panel del operador.
--
-- Mismo patrón de Vault que `dispatch_due_notifications()`
-- (`20260801160000_cron_engines.sql`): sin `perze_project_url`/
-- `perze_service_role_key` registrados (`docs/self-hosting.md`), sale en
-- silencio — nunca bloquea el alta de nadie por esto. La Edge Function
-- (`supabase/functions/notify-access-request`) hace el mismo chequeo con
-- `RESEND_API_KEY`/`EMAIL_FROM` del lado de ella.
--
-- `FOUND` después del INSERT — con `ON CONFLICT (id) DO NOTHING`, un
-- reintento de OAuth que ya tenía perfil no dispara un mail de más.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_url text;
  v_service_key text;
  v_is_operator boolean;
BEGIN
  v_is_operator := NEW.email = 'mjtorto@gmail.com';

  INSERT INTO public.profiles (id, display_name, locale, settings, is_app_admin, access_status, access_reviewed_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    'es',
    '{}'::jsonb,
    v_is_operator,
    CASE WHEN v_is_operator THEN 'approved' ELSE 'pending' END,
    CASE WHEN v_is_operator THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;

  IF NOT v_is_operator AND FOUND THEN
    SELECT decrypted_secret INTO v_project_url FROM vault.decrypted_secrets WHERE name = 'perze_project_url';
    SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'perze_service_role_key';
    IF v_project_url IS NOT NULL AND v_service_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_project_url || '/functions/v1/notify-access-request',
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key, 'Content-Type', 'application/json'),
        body := jsonb_build_object('profileId', NEW.id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
