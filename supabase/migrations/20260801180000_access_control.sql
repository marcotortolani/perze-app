-- Acceso controlado: rol de operador de la instancia, aprobación manual de
-- altas nuevas y métricas simples (ver plan de acceso controlado del
-- 2026-08-01). Hoy CUALQUIER email verificado por OTP entra a la app y
-- empieza a usar `households.enabled_modules` sin que nadie lo apruebe —
-- no sirve para una instancia personal que además se va a liberar como
-- open source.
--
-- Vocabulario: "admin" ya significa otra cosa en este schema
-- (`household_members.role = 'admin'`, un rol POR HOUSEHOLD). El rol nuevo
-- es de la INSTANCIA entera y se llama `is_app_admin` en columnas/funciones
-- para no colisionar; en el copy de la app se dice "operador de la
-- instancia", nunca "administrador".

ALTER TABLE public.profiles
  ADD COLUMN is_app_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN access_status text NOT NULL DEFAULT 'pending'
    CHECK (access_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN access_requested_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN access_reviewed_at timestamptz,
  ADD COLUMN access_reviewed_by uuid REFERENCES public.profiles (id),
  -- País elegido en A4 (onboarding), no geolocalización por IP — nunca se
  -- guarda una IP. Se completa desde `complete-onboarding.ts`.
  ADD COLUMN country text,
  -- Recencia de uso, no un log de actividad — un solo timestamp que el
  -- proxy actualiza como mucho una vez por día (ver `src/proxy.ts`).
  ADD COLUMN last_seen_at timestamptz;

-- Todo perfil nuevo nace `pending` por el DEFAULT de columna — no hace
-- falta tocar `handle_new_user()` (20260801030000_auth_new_user_trigger.sql).

-- `is_app_admin()` — mismo patrón que `is_household_admin()`
-- (20260801020400): SECURITY DEFINER + search_path vacío, para que las
-- policies y RPCs de este archivo lo llamen sin recursión de RLS.
CREATE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT p.is_app_admin FROM public.profiles p WHERE p.id = (SELECT auth.uid())),
    false
  );
$$;

-- Protege `is_app_admin`/`access_status` (y sus metadatos de revisión) de
-- la policy self-only de `profiles` (`profiles_update`, self `id = auth.uid()`
-- WITH CHECK): sin esto, cualquier usuario se auto-aprueba o se auto-asciende
-- con un UPDATE directo a su propia fila. Las tres RPC de abajo son el
-- único camino legítimo — marcan el GUC de sesión antes de escribir.
--
-- `is_app_admin` en sí NO tiene RPC de escritura a propósito: se decidió
-- un solo operador por instancia, asignado una vez por migración (ver el
-- bootstrap más abajo). Ascender a alguien más es una migración nueva, no
-- una pantalla — evita construir una gestión de roles que nadie pidió.
CREATE FUNCTION public.protect_access_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('perze.access_admin_write', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.is_app_admin IS DISTINCT FROM OLD.is_app_admin
    OR NEW.access_status IS DISTINCT FROM OLD.access_status
    OR NEW.access_reviewed_at IS DISTINCT FROM OLD.access_reviewed_at
    OR NEW.access_reviewed_by IS DISTINCT FROM OLD.access_reviewed_by
  THEN
    RAISE EXCEPTION 'Solo el operador de la instancia puede cambiar el estado de acceso'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_protect_access BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_access_columns();

-- ============================================================================
-- RPC del operador — las tres únicas que el cliente invoca (`.rpc(...)`).
-- Ninguna nombra `transactions`/`accounts`/`budgets` ni ninguna tabla
-- financiera: el límite es estructural, no una convención de código.
-- ============================================================================

-- Única columna de `auth.users` que se expone jamás a un rol que no sea el
-- dueño de la fila — por eso esto tiene que ser SECURITY DEFINER: PostgREST
-- corre como `authenticated`, que no tiene SELECT sobre `auth.users`.
CREATE FUNCTION public.admin_list_access_requests()
RETURNS TABLE (
  profile_id uuid,
  email text,
  display_name text,
  country text,
  access_status text,
  access_requested_at timestamptz,
  last_seen_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Solo el operador de la instancia puede ver esto'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, u.email, p.display_name, p.country, p.access_status, p.access_requested_at, p.last_seen_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.access_requested_at DESC;
END;
$$;

-- Agregados, nunca filas — ni siquiera el operador ve un movimiento, una
-- cuenta o un household ajeno desde acá.
CREATE FUNCTION public.admin_metrics()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Solo el operador de la instancia puede ver esto'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.profiles),
    'pending', (SELECT count(*) FROM public.profiles WHERE access_status = 'pending'),
    'approved', (SELECT count(*) FROM public.profiles WHERE access_status = 'approved'),
    'rejected', (SELECT count(*) FROM public.profiles WHERE access_status = 'rejected'),
    'byCountry', (
      SELECT COALESCE(jsonb_object_agg(bucket.country, bucket.cnt), '{}'::jsonb)
      FROM (
        SELECT COALESCE(country, 'desconocido') AS country, count(*) AS cnt
        FROM public.profiles
        WHERE access_status = 'approved'
        GROUP BY COALESCE(country, 'desconocido')
      ) bucket
    ),
    'activeToday', (SELECT count(*) FROM public.profiles WHERE last_seen_at >= now() - interval '1 day'),
    'active7d', (
      SELECT count(*) FROM public.profiles
      WHERE last_seen_at >= now() - interval '7 days' AND last_seen_at < now() - interval '1 day'
    ),
    'active30d', (
      SELECT count(*) FROM public.profiles
      WHERE last_seen_at >= now() - interval '30 days' AND last_seen_at < now() - interval '7 days'
    ),
    'inactive', (
      SELECT count(*) FROM public.profiles
      WHERE last_seen_at IS NULL OR last_seen_at < now() - interval '30 days'
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Aprobar/rechazar/revocar. No puede aplicarse a la propia fila del
-- operador (evita bloquearse a sí mismo por accidente) y valida el estado
-- contra la misma lista que el CHECK de la columna.
CREATE FUNCTION public.admin_set_access_status(target_id uuid, new_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Solo el operador de la instancia puede aprobar o rechazar accesos'
      USING ERRCODE = '42501';
  END IF;

  IF new_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Estado de acceso inválido: %', new_status
      USING ERRCODE = '22023'; -- invalid_parameter_value
  END IF;

  IF target_id = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'El operador no puede cambiar su propio estado de acceso'
      USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('perze.access_admin_write', 'true', true);
  UPDATE public.profiles
  SET access_status = new_status,
      access_reviewed_at = now(),
      access_reviewed_by = (SELECT auth.uid())
  WHERE id = target_id;
  PERFORM set_config('perze.access_admin_write', 'false', true);
END;
$$;

-- Convenio de GRANT/REVOKE de 20260801120000: `EXECUTE` explícito solo a
-- `authenticated`, nunca a `PUBLIC`/`anon`. `is_app_admin()` además se
-- llama desde policies futuras si hicieran falta, así que sigue el mismo
-- trato que `is_household_admin()`.
REVOKE EXECUTE ON FUNCTION public.is_app_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_list_access_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_access_requests() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_metrics() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_set_access_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_access_status(uuid, text) TO authenticated;

-- El trigger de protección corre para TODO UPDATE de `profiles`, incluido
-- el que hace `admin_set_access_status` bajo `SECURITY DEFINER` — de ahí el
-- GUC `perze.access_admin_write` (mismo mecanismo que
-- `perze.audit_retention_months` en 20260801160000_cron_engines.sql). No se
-- llama nunca directo desde el cliente.
REVOKE EXECUTE ON FUNCTION public.protect_access_columns() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- Bootstrap — el usuario que ya está usando la app antes de este cambio no
-- puede quedar bloqueado por su propio gate. Resuelto por email contra
-- `auth.users`, no por un uuid hardcodeado (la migración es portable a
-- cualquier fork, siempre que se edite este email antes de aplicarla).
-- ============================================================================
SELECT set_config('perze.access_admin_write', 'true', true);

UPDATE public.profiles p
SET is_app_admin = true,
    access_status = 'approved',
    access_reviewed_at = now()
FROM auth.users u
WHERE u.id = p.id
  AND u.email = 'mjtorto@gmail.com';

SELECT set_config('perze.access_admin_write', 'false', true);
