-- `admin_metrics()` sumaba pending+approved+rejected como si agotaran
-- `total`, y desde que existe el estado `disabled`
-- (`20260807130421_access_status_disabled.sql`) eso ya no es cierto: un
-- usuario deshabilitado quedaba contado en `total` pero en ningún bucket,
-- un desajuste que el operador vería sin explicación.
CREATE OR REPLACE FUNCTION public.admin_metrics()
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
    'disabled', (SELECT count(*) FROM public.profiles WHERE access_status = 'disabled'),
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
