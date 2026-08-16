-- Bloque de rebalanceo de inversiones: suma la dimensión `risk` a
-- `target_allocations.dimension`. Hoy soporta 'asset_class' | 'currency' |
-- 'country' | 'instrument' | 'sector' (20260801011010_investments.sql
-- línea 152) pero no `risk`, que es la dimensión que la pantalla de
-- rebalanceo agrupa por `asset_classes.default_risk` ('low'/'medium'/
-- 'high', ya poblado en las 12 clases sembradas —
-- 20260801070000_seed_asset_classes.sql / 20260801070100_fix_asset_classes_seed.sql).
--
-- El CHECK original es inline y sin nombre explícito, así que Postgres le
-- asignó el nombre por convención `<tabla>_<columna>_check` —
-- `target_allocations_dimension_check`. No hay acceso a la DB real desde
-- este entorno (proyecto remoto, sin Docker, CLAUDE.md) para confirmarlo
-- con `\d target_allocations`, pero es el único patrón de nombrado que usa
-- todo el resto del schema para un CHECK sin `CONSTRAINT <nombre>`
-- explícito (ver p.ej. `portfolios_visibility_check` en el mismo archivo,
-- misma convención). `IF EXISTS` es la red de seguridad si el nombre
-- resultara distinto: la migración no falla, y el ADD de abajo igual dobla
-- la validación (constraint nuevo con nombre propio, no depende de que el
-- DROP haya encontrado algo).
ALTER TABLE public.target_allocations DROP CONSTRAINT IF EXISTS target_allocations_dimension_check;

ALTER TABLE public.target_allocations
  ADD CONSTRAINT target_allocations_dimension_check
  CHECK (dimension IN ('asset_class', 'currency', 'country', 'instrument', 'sector', 'risk'));
