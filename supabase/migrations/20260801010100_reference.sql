-- 01-arquitectura-datos.md § 2.2, 2.6, § 3 Patrón C puro.
-- currencies/countries/fx_rates nunca tienen fila propia de un household:
-- nadie edita una moneda ni una cotización de mercado. Lectura para todo
-- autenticado, escritura solo por seeds y cron (service_role, que bypassea
-- RLS) — por eso no hay política de INSERT/UPDATE/DELETE para authenticated.

CREATE TABLE public.currencies (
  code text PRIMARY KEY, -- 'USD','ARS','UYU','BTC','USDT' — text, nunca char(3): USDT no entra en 3 y char rellena con espacios
  name text NOT NULL,
  symbol text NOT NULL,
  decimals smallint NOT NULL DEFAULT 2,
  kind text NOT NULL CHECK (kind IN ('fiat', 'crypto')),
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY currencies_select ON public.currencies FOR SELECT
USING (true);

CREATE TABLE public.countries (
  code char(2) PRIMARY KEY,
  name text NOT NULL,
  default_currency text REFERENCES public.currencies (code),
  flag_emoji text
);

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY countries_select ON public.countries FOR SELECT
USING (true);

-- El cliente NUNCA llama a una API externa de cotización — solo a
-- /api/fx, que consulta esta tabla y si no hay dato del día va a la
-- fuente, lo guarda acá y lo devuelve. Ver § 2.6, cadena de resolución.
CREATE TABLE public.fx_rates (
  base text NOT NULL REFERENCES public.currencies (code),
  quote text NOT NULL REFERENCES public.currencies (code),
  as_of date NOT NULL,
  provider text NOT NULL,
  quote_kind text NOT NULL DEFAULT 'default', -- 'oficial','blue','mep','ccl','custom'
  rate numeric(24, 12) NOT NULL,
  bid numeric(24, 12),
  ask numeric(24, 12),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (base, quote, as_of, provider, quote_kind)
);

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY fx_rates_select ON public.fx_rates FOR SELECT
USING (true);

CREATE INDEX fx_rates_lookup_idx ON public.fx_rates (base, quote, as_of DESC);
