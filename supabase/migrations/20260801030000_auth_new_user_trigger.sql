-- C7: sin esto, el primer login de un usuario nuevo (magic link u OAuth)
-- deja un auth.users sin fila en public.profiles — y profiles.id es la
-- PK que todo lo demás referencia (household_members.profile_id,
-- accounts.owner_id, etc.), así que el resto del onboarding no tiene
-- dónde anclarse. Patrón estándar de Supabase: un trigger AFTER INSERT en
-- auth.users, SECURITY DEFINER porque el rol que inserta en auth.users
-- (el de Supabase Auth) no tiene permiso de escribir en public.profiles
-- por sí mismo.
CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, locale, settings)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    'es',
    '{}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING; -- reintentos de OAuth no deben duplicar ni fallar
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
