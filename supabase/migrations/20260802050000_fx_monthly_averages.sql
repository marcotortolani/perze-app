-- Historial de tipo de cambio para métricas/gráficos futuros — no perfecto
-- día a día, un promedio por mes alcanza. `fx_rates` (E20/`daily-fx-sync`,
-- corre una vez por día) ya acumula una foto diaria sola: no hace falta un
-- snapshot semanal separado, el promedio mensual se calcula agregando lo
-- que `fx_rates` ya tiene para el mes en curso. Mismo Patrón C que
-- `currencies`/`fx_rates`: lectura para todo autenticado, escritura solo
-- por este cron (SECURITY DEFINER, bypassea RLS).
CREATE TABLE public.fx_rate_monthly_averages (
  base text NOT NULL REFERENCES public.currencies (code),
  quote text NOT NULL REFERENCES public.currencies (code),
  year_month text NOT NULL, -- 'YYYY-MM' — texto simple, no hay hora/zona que resolver en un promedio de mes
  avg_rate numeric(24, 12) NOT NULL,
  sample_count int NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (base, quote, year_month)
);

ALTER TABLE public.fx_rate_monthly_averages ENABLE ROW LEVEL SECURITY;

CREATE POLICY fx_rate_monthly_averages_select ON public.fx_rate_monthly_averages FOR SELECT
USING (true);

CREATE INDEX fx_rate_monthly_averages_lookup_idx ON public.fx_rate_monthly_averages (base, quote, year_month DESC);

-- Recalcula el mes EN CURSO cada vez que corre (idempotente por el
-- ON CONFLICT) — no hace falta "cerrar" el mes de forma especial, el
-- promedio converge solo a medida que `fx_rates` suma días. Un `quote_kind`
-- por par, no todos: dolarapi guarda oficial/blue/mep/ccl/mayorista/cripto/
-- tarjeta como filas separadas del MISMO par, promediarlas juntas mezclaría
-- cotizaciones que no son la misma cosa. 'oficial' es la referencia que ya
-- usa el resto de la app (`ds.fxEditor.source` = "DolarApi · oficial");
-- 'default' es el único quote_kind que escribe frankfurter.
CREATE FUNCTION public.compute_fx_monthly_averages()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.fx_rate_monthly_averages (base, quote, year_month, avg_rate, sample_count, computed_at)
  SELECT
    base,
    quote,
    to_char(current_date, 'YYYY-MM'),
    avg(rate),
    count(*),
    now()
  FROM public.fx_rates
  WHERE quote_kind IN ('default', 'oficial')
    AND as_of >= date_trunc('month', current_date)::date
    AND as_of < current_date + interval '1 day'
  GROUP BY base, quote
  ON CONFLICT (base, quote, year_month) DO UPDATE SET
    avg_rate = excluded.avg_rate,
    sample_count = excluded.sample_count,
    computed_at = excluded.computed_at;
END;
$$;

-- Corre después del sync diario (9:00 UTC) para que el día de hoy ya esté en `fx_rates`.
SELECT cron.schedule('perze-fx-monthly-average', '10 9 * * *', 'SELECT public.compute_fx_monthly_averages();');
