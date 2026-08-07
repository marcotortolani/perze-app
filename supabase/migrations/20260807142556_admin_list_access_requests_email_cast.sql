-- Bug real, no introducido por la migración anterior pero recién ejercitado
-- ahora: `auth.users.email` es `character varying(255)`, y `RETURN QUERY`
-- exige coincidencia exacta de tipo contra `RETURNS TABLE`, no solo
-- asignabilidad — a diferencia de un `SELECT` normal, donde varchar→text
-- es implícito. PostgREST devolvía 42804 "structure of query does not
-- match function result type" en cada llamada a
-- `admin_list_access_requests()`, así que "Todos los usuarios" nunca cargó
-- una fila real. Se cierra con un cast explícito.
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
  SELECT p.id, u.email::text, p.display_name, p.country, p.access_status, p.access_requested_at, p.last_seen_at, p.is_app_admin
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.access_requested_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_access_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_access_requests() TO authenticated;
