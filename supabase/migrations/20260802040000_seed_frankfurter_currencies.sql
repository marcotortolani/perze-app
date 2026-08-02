-- `/api/fx` valida `base`/`quote` contra `public.currencies` antes de
-- resolver nada (Patrón C: catálogo global, escritura solo por seeds/Edge
-- Functions — `CLAUDE.md`). El proveedor `frankfurter` (BCE) cubre 30
-- códigos reales, pero solo 4 de esos 30 estaban sembrados acá (USD, BRL,
-- MXN, EUR) — para el resto, `/currencies` podía dejar elegir la moneda
-- pero el rate sugerido siempre iba a fallar con MONEDA_DESCONOCIDA, sin
-- importar que el proveedor sí tuviera el par. Se sube el catálogo a la
-- cobertura real de Frankfurter (`src/lib/fx/providers/frankfurter.ts`).
-- ARS/UYU y crypto siguen sin cotización automática — eso lo resuelve
-- dolarapi (solo ARS/USD) o el override manual, no este seed.
INSERT INTO public.currencies (code, name, symbol, decimals, kind, is_active) VALUES
  ('AUD', 'Dólar australiano', 'AU$', 2, 'fiat', true),
  ('CAD', 'Dólar canadiense', 'CA$', 2, 'fiat', true),
  ('CHF', 'Franco suizo', 'CHF', 2, 'fiat', true),
  ('CNY', 'Yuan chino', 'CN¥', 2, 'fiat', true),
  ('CZK', 'Corona checa', 'Kč', 2, 'fiat', true),
  ('DKK', 'Corona danesa', 'kr', 2, 'fiat', true),
  ('GBP', 'Libra esterlina', '£', 2, 'fiat', true),
  ('HKD', 'Dólar de Hong Kong', 'HK$', 2, 'fiat', true),
  ('HUF', 'Florín húngaro', 'Ft', 2, 'fiat', true),
  ('IDR', 'Rupia indonesia', 'Rp', 2, 'fiat', true),
  ('ILS', 'Nuevo shekel israelí', '₪', 2, 'fiat', true),
  ('INR', 'Rupia india', '₹', 2, 'fiat', true),
  ('ISK', 'Corona islandesa', 'kr', 2, 'fiat', true),
  ('JPY', 'Yen japonés', '¥', 0, 'fiat', true),
  ('KRW', 'Won surcoreano', '₩', 0, 'fiat', true),
  ('MYR', 'Ringgit malayo', 'RM', 2, 'fiat', true),
  ('NOK', 'Corona noruega', 'kr', 2, 'fiat', true),
  ('NZD', 'Dólar neozelandés', 'NZ$', 2, 'fiat', true),
  ('PHP', 'Peso filipino', '₱', 2, 'fiat', true),
  ('PLN', 'Zloty polaco', 'zł', 2, 'fiat', true),
  ('RON', 'Leu rumano', 'lei', 2, 'fiat', true),
  ('SEK', 'Corona sueca', 'kr', 2, 'fiat', true),
  ('SGD', 'Dólar de Singapur', 'SG$', 2, 'fiat', true),
  ('THB', 'Baht tailandés', '฿', 2, 'fiat', true),
  ('TRY', 'Lira turca', '₺', 2, 'fiat', true),
  ('ZAR', 'Rand sudafricano', 'R', 2, 'fiat', true)
ON CONFLICT (code) DO NOTHING;
