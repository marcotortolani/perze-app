-- 01-arquitectura-datos.md § 2.6. Paso 1 de la cadena de resolución de FX.
-- Es un HECHO CON FECHA, no una preferencia: se consulta por la fecha del
-- movimiento, no por "el último". Bitácora inmutable por convención de app:
-- cambiar un rate implica insertar una fila nueva con nuevo valid_from y
-- cerrar la anterior con valid_to, nunca pisar rate en la misma fila.
CREATE TABLE public.fx_overrides (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  base_currency text NOT NULL REFERENCES public.currencies (code),
  quote_currency text NOT NULL REFERENCES public.currencies (code),
  rate numeric(24, 12) NOT NULL,
  valid_from date NOT NULL,
  valid_to date, -- NULL = vigente
  reason text,
  created_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fx_overrides_lookup_idx
ON public.fx_overrides (household_id, base_currency, quote_currency, valid_from DESC);

ALTER TABLE public.fx_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY fx_overrides_select ON public.fx_overrides FOR SELECT
USING (household_id IN (SELECT public.current_households()));

CREATE POLICY fx_overrides_insert ON public.fx_overrides FOR INSERT
WITH CHECK (public.can_write(household_id) AND created_by = (SELECT auth.uid()));

-- Solo para cerrar una vigencia (valid_to) al abrir la siguiente — la app
-- nunca reescribe `rate` de una fila existente, aunque la policy no lo
-- imponga a nivel de columna.
CREATE POLICY fx_overrides_update ON public.fx_overrides FOR UPDATE
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (household_id = (SELECT fx_overrides.household_id));
