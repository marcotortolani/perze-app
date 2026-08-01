-- Corrige `20260801070000_seed_asset_classes.sql`: inventó una lista corta
-- de 6 clases con nombres en español ("Cripto", "Bonos", "Otro") sin
-- revisar antes que `docs/01-arquitectura-datos.md` § 2.8 ya prescribe la
-- semilla exacta: "Acciones, CEDEARs, Bonos soberanos, ONs, Letras, FCI,
-- Plazo fijo, Crypto, ETFs, Inmuebles, Efectivo, Otros" (12, no 6). Además
-- `lib/money/decimals.ts` (`ASSET_CLASS_QUANTITY_DECIMALS`) busca por el
-- nombre exacto "Crypto" — con "Cripto" la cantidad de una cripto se
-- redondeaba mal en silencio, el mismo bug que esa tabla existe para evitar.

UPDATE public.asset_classes SET name = 'Crypto' WHERE id = '00000000-0000-0000-0000-00000000ac04' AND name = 'Cripto';
UPDATE public.asset_classes SET name = 'Bonos soberanos' WHERE id = '00000000-0000-0000-0000-00000000ac02' AND name = 'Bonos';
UPDATE public.asset_classes SET name = 'Otros' WHERE id = '00000000-0000-0000-0000-00000000ac06' AND name = 'Otro';

INSERT INTO public.asset_classes (id, household_id, name, icon, color, sort_order, default_risk) VALUES
  ('00000000-0000-0000-0000-00000000ac07', NULL, 'CEDEARs', 'trend', 'var(--data-1)', 7, 'high'),
  ('00000000-0000-0000-0000-00000000ac08', NULL, 'ONs', 'chart', 'var(--data-2)', 8, 'medium'),
  ('00000000-0000-0000-0000-00000000ac09', NULL, 'Letras', 'chart', 'var(--data-2)', 9, 'low'),
  ('00000000-0000-0000-0000-00000000ac10', NULL, 'ETFs', 'trend', 'var(--data-1)', 10, 'medium'),
  ('00000000-0000-0000-0000-00000000ac11', NULL, 'Inmuebles', 'home', 'var(--data-3)', 11, 'medium'),
  ('00000000-0000-0000-0000-00000000ac12', NULL, 'Efectivo', 'banknote', 'var(--data-5)', 12, 'low')
ON CONFLICT (id) DO NOTHING;
