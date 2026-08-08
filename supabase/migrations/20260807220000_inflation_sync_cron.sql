-- H7 — cron diario de inflación: sin esto `price_index` queda vacía para
-- siempre (nada más la escribe, Patrón C). Mismo patrón que
-- `trigger_daily_fx_sync` (`20260801160000_cron_engines.sql`): llama a la
-- Edge Function `daily-inflation-sync` (nueva, `supabase/functions/`) vía
-- `pg_net`, sale en silencio si los secrets de Vault no están registrados
-- (mismos dos que ya usa el resto de los cron jobs — ver docs/self-hosting.md).
CREATE FUNCTION public.trigger_daily_inflation_sync()
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
    url := v_project_url || '/functions/v1/daily-inflation-sync',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
END;
$$;

-- Mismo horario que `perze-daily-fx-sync` (madrugada, fuera del pico de
-- captura en Uruguay/Argentina/Brasil). El IPC es mensual y la serie
-- completa (~1000 meses) se resincroniza entera cada corrida — correrlo
-- todos los días es barato y agarra la revisión del dato provisorio del
-- mes en curso apenas la fuente la publica, sin esperar a un cron mensual
-- aparte.
SELECT cron.schedule('perze-daily-inflation-sync', '10 9 * * *', 'SELECT public.trigger_daily_inflation_sync();');
