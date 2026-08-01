-- Encontrado probando C7 de punta a punta: no había NINGÚN dato de
-- referencia real en este proyecto (`currencies`/`countries` vacías) —
-- solo las filas ARS/USD que insertaron los tests de RLS como fixture.
-- `docs/01-arquitectura-datos.md` § 5 prevé `supabase/seed/` para esto y
-- nunca se escribió; sin esto, cualquier INSERT real de `accounts` o
-- `households` (que referencian `currency_code`/`country_code` por FK)
-- falla en la primera cuenta que alguien intente crear. Mismo recorte de
-- mercados que `src/lib/reference/countries-currencies.ts` — sumar un
-- país/moneda nuevo es una fila acá, nunca un cambio de código.
INSERT INTO public.currencies (code, name, symbol, decimals, kind, is_active) VALUES
  ('UYU', 'Peso uruguayo', '$', 2, 'fiat', true),
  ('ARS', 'Peso argentino', 'AR$', 2, 'fiat', true),
  ('USD', 'Dólar estadounidense', 'US$', 2, 'fiat', true),
  ('BRL', 'Real brasileño', 'R$', 2, 'fiat', true),
  ('MXN', 'Peso mexicano', 'MX$', 2, 'fiat', true),
  ('CLP', 'Peso chileno', 'CLP$', 0, 'fiat', true),
  ('EUR', 'Euro', '€', 2, 'fiat', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.countries (code, name, default_currency) VALUES
  ('UY', 'Uruguay', 'UYU'),
  ('AR', 'Argentina', 'ARS'),
  ('BR', 'Brasil', 'BRL'),
  ('US', 'Estados Unidos', 'USD'),
  ('MX', 'México', 'MXN'),
  ('CL', 'Chile', 'CLP')
ON CONFLICT (code) DO NOTHING;
