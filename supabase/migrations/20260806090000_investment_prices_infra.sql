-- Bloque I — infraestructura real de precios de instrumentos, que hasta
-- ahora no existía: `price_snapshots` solo tenía policy de SELECT, y
-- `priceSnapshotsRepo.setManual()` (I12, "cargar precio a mano") hacía un
-- `.upsert()` desde el cliente que la RLS rechazaba en silencio — la
-- funcionalidad "siempre podés cargar el precio a mano" (regla cerrada en
-- `01-arquitectura-datos.md` § 2.8, "imprescindible para FCI, plazo fijo,
-- inmuebles, ONs poco líquidas") estaba rota en producción.
--
-- El INSERT/UPDATE queda acotado a `provider = 'manual'` — un cliente
-- autenticado puede agregar SU precio manual a cualquier instrumento que
-- pueda ver (Patrón C: el catálogo es compartido), pero nunca puede
-- escribir con `provider` de un proveedor real (eso lo hace solo
-- `daily-price-sync`/`/api/prices` con `service_role`, que bypassea RLS).

CREATE POLICY price_snapshots_manual_write ON public.price_snapshots FOR INSERT
WITH CHECK (
  provider = 'manual'
  AND EXISTS (
    SELECT 1 FROM public.instruments i
    WHERE i.id = price_snapshots.instrument_id
      AND (i.household_id IS NULL OR i.household_id IN (SELECT public.current_households()))
  )
);

CREATE POLICY price_snapshots_manual_update ON public.price_snapshots FOR UPDATE
USING (provider = 'manual')
WITH CHECK (provider = 'manual');

-- Cron diario de precios — mismo patrón que `trigger_daily_fx_sync()`
-- (`20260801160000_cron_engines.sql`): sin esto, `price_snapshots` nunca
-- se puebla sola, y `PricesStatusPage` (I12) no tendría nada que mostrar
-- fuera de lo cargado a mano. Corre después del sync de FX (9:00 UTC) —
-- los precios en moneda nativa no dependen de que el FX ya esté fresco,
-- pero mantener el mismo horario evita otro punto de programación distinto
-- que recordar.
CREATE FUNCTION public.trigger_daily_price_sync()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_url text;
  v_service_key text;
BEGIN
  SELECT decrypted_secret INTO v_project_url FROM vault.decrypted_secrets WHERE name = 'perze_project_url';
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'perze_service_role_key';
  IF v_project_url IS NULL OR v_service_key IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_project_url || '/functions/v1/daily-price-sync',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
END;
$$;

SELECT cron.schedule('perze-daily-price-sync', '10 9 * * *', 'SELECT public.trigger_daily_price_sync();');
