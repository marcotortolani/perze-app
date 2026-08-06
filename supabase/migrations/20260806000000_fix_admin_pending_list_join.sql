-- `admin_list_access_requests()` (20260801180000_access_control.sql) hacía
-- un INNER JOIN contra `auth.users` para traer el email. `admin_metrics()`
-- cuenta pendientes directo sobre `profiles`, sin ese join, y contaba bien
-- (confirmado en producción: "Pendientes: 1" en las métricas) mientras la
-- lista de solicitudes pendientes aparecía vacía — el INNER JOIN estaba
-- perdiendo la fila en silencio para al menos un caso real. LEFT JOIN: una
-- solicitud de acceso nunca desaparece de la lista del operador por un
-- problema de resolución del email; en el peor caso, `email` sale `NULL`
-- y la UI ya cae a `displayName`/`profileId` (`adminPage`, `src/app/(app)/
-- more/admin/page.tsx:97`).
CREATE OR REPLACE FUNCTION public.admin_list_access_requests()
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
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY p.access_requested_at DESC;
END;
$$;
