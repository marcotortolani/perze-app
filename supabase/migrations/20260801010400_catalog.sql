-- 01-arquitectura-datos.md § 2.2, 2.8, § 3 Patrón C con clonado.
-- institutions/asset_classes/instruments tienen filas globales sembradas
-- (household_id IS NULL) y filas propias del household. Lectura para todo
-- autenticado, escritura nunca sobre una fila global — el usuario clona
-- (copy-on-write) con source_id apuntando al original.

-- CON-23 (docs/plan-de-trabajo.md § 4): interest_rate/coupon_rate
-- numeric(8,4) e instruments.ratio numeric(12,6) rompen a propósito la
-- convención general de money=bigint / cantidades=numeric(38,12) /
-- rates=numeric(24,12). Son tasas porcentuales (ej. 12.3456%) y ratios de
-- conversión de CEDEAR (ej. 10 acciones por CEDEAR), no montos ni tipos de
-- cambio — su escala real nunca necesita más de 4-6 decimales. No "corregir"
-- a numeric(24,12) en una migración futura.

CREATE TABLE public.institutions (
  id uuid PRIMARY KEY,
  household_id uuid REFERENCES public.households (id), -- NULL = catálogo global sembrado
  name text NOT NULL,
  country_code char(2) REFERENCES public.countries (code),
  kind text NOT NULL,
  logo_url text, -- slot opcional; CON-29: la app renderiza monograma sobre `color`, nunca este logo
  color text NOT NULL,
  source_id uuid REFERENCES public.institutions (id) -- si vino de una fila global, cuál era
);

CREATE TABLE public.asset_classes (
  id uuid PRIMARY KEY,
  household_id uuid REFERENCES public.households (id), -- NULL = plantilla global
  name text NOT NULL,
  icon text,
  color text,
  sort_order int,
  default_risk text,
  source_id uuid REFERENCES public.asset_classes (id)
);

CREATE TABLE public.instruments (
  id uuid PRIMARY KEY,
  household_id uuid REFERENCES public.households (id), -- NULL = catálogo compartido
  symbol text NOT NULL,
  name text NOT NULL,
  asset_class_id uuid REFERENCES public.asset_classes (id),
  currency_code text NOT NULL REFERENCES public.currencies (code),
  country_code char(2) REFERENCES public.countries (code),
  exchange text,
  isin text,
  cusip text,
  ratio numeric(12, 6), -- CEDEAR: acciones subyacentes por CEDEAR. Ver nota CON-23 arriba.
  underlying_symbol text,
  price_provider text,
  provider_symbol text,
  -- renta fija
  maturity_date date,
  coupon_rate numeric(8, 4), -- ver nota CON-23 arriba
  coupon_frequency int,
  amortization_schedule jsonb,
  issuer text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_manual boolean NOT NULL DEFAULT false,
  source_id uuid REFERENCES public.instruments (id)
);

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY institutions_select ON public.institutions FOR SELECT
USING (household_id IS NULL OR household_id IN (SELECT public.current_households()));

CREATE POLICY institutions_write ON public.institutions FOR ALL
USING (household_id IS NOT NULL AND public.can_write(household_id))
WITH CHECK (household_id IS NOT NULL AND public.can_write(household_id));

ALTER TABLE public.asset_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_classes_select ON public.asset_classes FOR SELECT
USING (household_id IS NULL OR household_id IN (SELECT public.current_households()));

CREATE POLICY asset_classes_write ON public.asset_classes FOR ALL
USING (household_id IS NOT NULL AND public.can_write(household_id))
WITH CHECK (household_id IS NOT NULL AND public.can_write(household_id));

ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;

CREATE POLICY instruments_select ON public.instruments FOR SELECT
USING (household_id IS NULL OR household_id IN (SELECT public.current_households()));

CREATE POLICY instruments_write ON public.instruments FOR ALL
USING (household_id IS NOT NULL AND public.can_write(household_id))
WITH CHECK (household_id IS NOT NULL AND public.can_write(household_id));
