-- A3 (auditoría técnica) — la conversión de captura (moneda tipeada →
-- moneda de cuenta) no tenía forma de quedar "pendiente": el CHECK
-- `original_triple` exigía que `original_rate` fuera no-NULL siempre que
-- `original_amount`/`original_currency` lo fueran, así que sin cotización
-- disponible el código reinterpretaba el número tipeado como si ya
-- estuviera en la moneda de la cuenta (100 USD tipeados → 100 ARS
-- guardados). Simétrico al patrón de `needs_fx` ya existente para la
-- conversión de cuenta → moneda base, pero para la conversión de captura.
--
-- No se toca `fx_pair` (`fx_rate`/`amount_base`, la cadena needs_fx real)
-- ni la regla de `CLAUDE.md` de nunca inventar un rate — acá directamente
-- se permite dejar `original_rate` en NULL mientras se resuelve.

ALTER TABLE public.transactions
  DROP CONSTRAINT original_triple,
  ADD CONSTRAINT original_triple CHECK (
    (original_amount IS NULL) = (original_currency IS NULL)
  ),
  ADD COLUMN needs_capture_fx boolean GENERATED ALWAYS AS (
    original_amount IS NOT NULL AND original_rate IS NULL
  ) STORED;

COMMENT ON COLUMN public.transactions.needs_capture_fx IS
  'true cuando se tipeó en una moneda distinta a la de la cuenta y esa '
  'conversión de captura no resolvió (sin cotización disponible en el '
  'momento). Distinto de needs_fx (fx_rate/amount_base, cuenta → base) — '
  'un movimiento puede necesitar una, la otra, las dos, o ninguna.';

CREATE INDEX transactions_needs_capture_fx_idx ON public.transactions (household_id)
  WHERE needs_capture_fx;
