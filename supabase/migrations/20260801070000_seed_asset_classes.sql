-- Bloque I (docs/plan-de-trabajo.md § 6.11). `asset_classes` (Patrón C,
-- `household_id IS NULL` = plantilla global) nunca se sembró — sin esto,
-- I7b (crear instrumento a mano) no tiene qué ofrecer en el picker de
-- clase de activo. Misma idea que `20260801030200_seed_reference_data.sql`
-- para currencies/countries.
-- IDs fijos (no `gen_random_uuid()`) para que `ON CONFLICT (id)` sea
-- realmente idempotente si esta migración se corriera dos veces.
INSERT INTO public.asset_classes (id, household_id, name, icon, color, sort_order, default_risk) VALUES
  ('00000000-0000-0000-0000-00000000ac01', NULL, 'Acciones', 'trend', 'var(--data-1)', 1, 'high'),
  ('00000000-0000-0000-0000-00000000ac02', NULL, 'Bonos', 'chart', 'var(--data-2)', 2, 'medium'),
  ('00000000-0000-0000-0000-00000000ac03', NULL, 'FCI', 'piggy-bank', 'var(--data-3)', 3, 'medium'),
  ('00000000-0000-0000-0000-00000000ac04', NULL, 'Cripto', 'invest', 'var(--data-4)', 4, 'high'),
  ('00000000-0000-0000-0000-00000000ac05', NULL, 'Plazo fijo', 'banknote', 'var(--data-5)', 5, 'low'),
  ('00000000-0000-0000-0000-00000000ac06', NULL, 'Otro', 'wallet', 'var(--data-other)', 6, 'medium')
ON CONFLICT (id) DO NOTHING;
