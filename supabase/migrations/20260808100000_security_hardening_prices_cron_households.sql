-- Auditoría de seguridad (docs/auditoria/) — cuatro hallazgos independientes
-- del modelo de household, todos en el borde: dato de mercado y superficie
-- de ejecución de funciones de sistema. El núcleo de aislamiento por
-- household (accounts/transactions/budgets/... vía current_households(),
-- los triggers de inmutabilidad de household_id) no se toca acá.

-- ---------------------------------------------------------------------
-- 1. price_snapshots: única fuga real de lectura/escritura cruzada.
-- ---------------------------------------------------------------------
-- `price_snapshots_select` (20260801011010_investments.sql:146-147) es
-- `USING (true)` desde que la tabla era solo dato de mercado global. Pero
-- `price_snapshots_manual_write` (20260806090000:15-23) habilitó al
-- cliente a insertar precios manuales para instrumentos con household_id
-- PROPIO (no solo catálogo compartido) — desde entonces, cualquier
-- autenticado lee la valuación manual que otro household cargó a mano para
-- un inmueble, un plazo fijo o una ON poco líquida. Y
-- `price_snapshots_manual_update` (20260806090000:25-27) no tiene scope
-- alguno: cualquiera puede reescribir el precio manual de cualquiera.
--
-- No rompe nada existente: daily-price-sync usa service_role (bypassea
-- RLS); /api/prices lee `instruments` primero y devuelve 404 antes de
-- tocar price_snapshots si no es visible; priceSnapshotsRepo filtra por
-- ids que ya salen de trades del propio household.
DROP POLICY price_snapshots_select ON public.price_snapshots;
CREATE POLICY price_snapshots_select ON public.price_snapshots FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.instruments i
    WHERE i.id = price_snapshots.instrument_id
      AND (i.household_id IS NULL OR i.household_id IN (SELECT public.current_households()))
  )
);

DROP POLICY price_snapshots_manual_update ON public.price_snapshots;
CREATE POLICY price_snapshots_manual_update ON public.price_snapshots FOR UPDATE
USING (
  provider = 'manual'
  AND EXISTS (
    SELECT 1 FROM public.instruments i
    WHERE i.id = price_snapshots.instrument_id
      AND (i.household_id IS NULL OR i.household_id IN (SELECT public.current_households()))
  )
)
WITH CHECK (
  provider = 'manual'
  AND EXISTS (
    SELECT 1 FROM public.instruments i
    WHERE i.id = price_snapshots.instrument_id
      AND (i.household_id IS NULL OR i.household_id IN (SELECT public.current_households()))
  )
);

-- Nota para más adelante, no se resuelve acá: la PK de price_snapshots es
-- (instrument_id, as_of, provider) — dos households no pueden tener
-- precios manuales distintos del mismo instrumento GLOBAL el mismo día.
-- Arreglarlo de verdad pide un household_id en la tabla.

-- ---------------------------------------------------------------------
-- 2. Funciones de cron SECURITY DEFINER sin REVOKE — invocables por
--    cualquier `authenticated` vía PostgREST, corren sobre TODOS los
--    households. Ninguna filtra datos (todas devuelven void), pero
--    cualquiera puede dispararlas: purgar audit log, materializar
--    recurrentes ajenos, gastar cuota de las Edge Functions de sync.
--    pg_cron sigue funcionando después del REVOKE: los jobs corren como
--    el rol que los agendó (el dueño de las funciones), que conserva su
--    EXECUTE implícito — mismo patrón ya aplicado a
--    open_card_statements() en 20260804010000:154-155,391.
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.materialize_recurring_transactions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dispatch_due_notifications() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.close_overdue_card_statements() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_audit_log() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prune_push_subscriptions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_fx_monthly_averages() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_daily_fx_sync() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_daily_price_sync() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_daily_inflation_sync() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. households.created_by mutable — households no está en ninguno de los
--    21 triggers de 20260801130000_immutability_triggers.sql y
--    households_update no restringe columnas. Un member puede reescribir
--    created_by (o base_country, name, etc. sin dueño). base_currency NO
--    va en este trigger: cambiarla es una función real de producto que se
--    resuelve con su propia RPC de re-resolución de FX, no bloqueándola.
-- ---------------------------------------------------------------------
CREATE TRIGGER households_immutable BEFORE UPDATE ON public.households
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('id', 'created_by');
