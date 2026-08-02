-- El bootstrap de operador de 20260801180000 corre UNA vez, contra los
-- perfiles que ya existían al aplicar la migración. Si la cuenta del
-- operador se crea (o se recrea) DESPUÉS, su perfil nace `pending` por el
-- DEFAULT de columna y la instancia queda sin nadie que pueda aprobar:
-- el operador se bloquea con su propio gate. Fix: `handle_new_user()`
-- otorga operador + aprobación en el INSERT cuando el email del alta es el
-- del operador de la instancia (mismo criterio "por email, editable en un
-- fork" que el bootstrap original). El trigger `profiles_protect_access`
-- es BEFORE UPDATE, así que este INSERT no lo pelea.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, locale, settings, is_app_admin, access_status, access_reviewed_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    'es',
    '{}'::jsonb,
    NEW.email = 'mjtorto@gmail.com',
    CASE WHEN NEW.email = 'mjtorto@gmail.com' THEN 'approved' ELSE 'pending' END,
    CASE WHEN NEW.email = 'mjtorto@gmail.com' THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING; -- reintentos de OAuth no deben duplicar ni fallar
  RETURN NEW;
END;
$$;

-- Re-corre el bootstrap original, idempotente — cubre el caso en que la
-- cuenta del operador se creó entre la migración 180000 y esta.
SELECT set_config('perze.access_admin_write', 'true', true);

UPDATE public.profiles p
SET is_app_admin = true,
    access_status = 'approved',
    access_reviewed_at = COALESCE(p.access_reviewed_at, now())
FROM auth.users u
WHERE u.id = p.id
  AND u.email = 'mjtorto@gmail.com'
  AND (NOT p.is_app_admin OR p.access_status <> 'approved');

SELECT set_config('perze.access_admin_write', 'false', true);
