-- Bug real reportado: "By age range" en el panel de operador mostraba
-- vacío pese a que los usuarios aprobados tenían `birth_date` cargado.
-- Causa: `20260807130849_admin_metrics_disabled_count.sql` (que sumó el
-- conteo `disabled`) se escribió a partir de una copia de
-- `admin_metrics()` anterior a `20260803010000_admin_age_ranges.sql` —
-- `CREATE OR REPLACE FUNCTION` no avisa cuando el reemplazo pisa una
-- columna que el original sí tenía, así que `byAgeRange` desapareció en
-- silencio. Se restaura junto con `disabled`, que sigue siendo necesario.
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
    'byAgeRange', (
      SELECT COALESCE(jsonb_object_agg(bucket.range, bucket.cnt), '{}'::jsonb)
      FROM (
        SELECT
          CASE
            WHEN birth_date IS NULL THEN 'desconocido'
            WHEN age(birth_date) < interval '25 years' THEN '<25'
            WHEN age(birth_date) < interval '35 years' THEN '25-34'
            WHEN age(birth_date) < interval '45 years' THEN '35-44'
            WHEN age(birth_date) < interval '55 years' THEN '45-54'
            WHEN age(birth_date) < interval '65 years' THEN '55-64'
            ELSE '65+'
          END AS range,
          count(*) AS cnt
        FROM public.profiles
        WHERE access_status = 'approved'
        GROUP BY 1
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
