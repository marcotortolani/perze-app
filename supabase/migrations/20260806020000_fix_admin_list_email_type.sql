-- La causa real de "solicitudes pendientes" vacío en el panel del
-- operador — el `LEFT JOIN` de 20260806000000 no era el problema, aunque
-- es una mejora legítima aparte. El error real, invisible hasta ahora
-- porque nadie había llamado a esta función con una fila real que pasar
-- por `RETURN QUERY`:
--
--   ERROR 42804: structure of query does not match function result type
--   Returned type character varying(255) does not match expected type
--   text in column 2.
--
-- `auth.users.email` es `character varying(255)`, no `text` — Postgres
-- exige coincidencia exacta de tipo en un `RETURN QUERY` de una función
-- `RETURNS TABLE`, a diferencia de un `SELECT` suelto (donde `varchar` y
-- `text` son intercambiables sin quejarse). Por eso un SQL directo contra
-- el mismo `SELECT` nunca mostraba el error, y por eso `admin_metrics()`
-- —que devuelve `jsonb`, sin esta clase de chequeo— nunca lo tuvo.
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
  SELECT p.id, u.email::text, p.display_name, p.country, p.access_status, p.access_requested_at, p.last_seen_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY p.access_requested_at DESC;
END;
$$;
