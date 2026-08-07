-- Bug real reportado: el operador se veía a sí mismo (y a cualquier otro
-- operador) con el botón "Deshabilitar acceso" en el listado de usuarios.
-- `admin_set_access_status()` ya bloqueaba `target_id = auth.uid()`
-- (auto-modificación), pero nada bloqueaba que un operador deshabilitara a
-- OTRO operador — y la UI ni siquiera sabía quién era operador para poder
-- ocultar el botón, porque `admin_list_access_requests()` no devolvía
-- `is_app_admin`. Las tres RPC son la barrera real (la UI nunca es la
-- única, CLAUDE.md) — acá se cierran las dos puntas: el dato para que el
-- cliente pueda ocultar el botón, y el rechazo server-side por si igual
-- se invoca la RPC a mano.
-- `CREATE OR REPLACE` no puede cambiar el tipo de retorno de una función
-- (`RETURNS TABLE` gana una columna) — hace falta `DROP` primero.
DROP FUNCTION IF EXISTS public.admin_list_access_requests();

CREATE FUNCTION public.admin_list_access_requests()
RETURNS TABLE (
  profile_id uuid,
  email text,
  display_name text,
  country text,
  access_status text,
  access_requested_at timestamptz,
  last_seen_at timestamptz,
  is_app_admin boolean
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
  SELECT p.id, u.email, p.display_name, p.country, p.access_status, p.access_requested_at, p.last_seen_at, p.is_app_admin
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.access_requested_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_access_status(target_id uuid, new_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Solo el operador de la instancia puede aprobar o rechazar accesos'
      USING ERRCODE = '42501';
  END IF;

  IF new_status NOT IN ('pending', 'approved', 'rejected', 'disabled') THEN
    RAISE EXCEPTION 'Estado de acceso inválido: %', new_status
      USING ERRCODE = '22023'; -- invalid_parameter_value
  END IF;

  IF target_id = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'El operador no puede cambiar su propio estado de acceso'
      USING ERRCODE = '42501';
  END IF;

  IF (SELECT is_app_admin FROM public.profiles WHERE id = target_id) THEN
    RAISE EXCEPTION 'No se puede cambiar el estado de acceso de otro operador de la instancia'
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

-- `DROP FUNCTION` se lleva los GRANT con la función vieja — hay que
-- volver a otorgarlos, mismo convenio que `20260801180000_access_control.sql`.
REVOKE EXECUTE ON FUNCTION public.admin_list_access_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_access_requests() TO authenticated;
