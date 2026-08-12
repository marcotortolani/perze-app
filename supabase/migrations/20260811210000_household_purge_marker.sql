-- Marca de "Borrar todos mis datos" (`purge_household_step`,
-- `20260804000000_purge_household.sql`), para que un dispositivo QUE NO
-- CORRIÓ el purge se entere de que pasó.
--
-- El problema que resuelve: `transactions` se pulea de forma incremental
-- por watermark (`pull.ts` § pullTransactions) y depende de que un borrado
-- llegue como una fila con `deleted_at` seteado y un `updated_at` nuevo —
-- así es como el pull incremental se entera de un soft-delete de otro
-- dispositivo. El purge, en cambio, hace `DELETE FROM public.transactions`
-- real (excepción documentada en `20260804000000_purge_household.sql`):
-- esas filas simplemente dejan de existir y nunca aparecen en ninguna
-- página del pull incremental. Resultado, sin este marcador: un segundo
-- dispositivo (o la misma cuenta en otro navegador) conserva sus
-- `transactions` en Dexie para siempre, y el calendario de `/transactions`
-- sigue pintando días de movimientos que el servidor ya no tiene —
-- "actividad fantasma" indistinguible de un bug de UI.
--
-- La solución NO es hacer incremental el borrado (reescribir el purge para
-- que soft-borre y purgue después complica la única garantía que importa
-- acá, que el borrado sea REAL). Es más simple: `households.purged_at` es
-- un semáforo que cualquier dispositivo YA está mirando en cada pull
-- (`refreshHousehold` trae la fila del household en cada ciclo) — si ve un
-- `purged_at` más nuevo que el que tiene guardado, vacía su Dexie con la
-- misma rutina que ya corre el dispositivo que ejecutó el purge
-- (`wipeLocalHouseholdData`, `purge-reconcile.ts`).
ALTER TABLE public.households ADD COLUMN purged_at timestamptz;

-- Separada de `purge_household_step` (no un `CREATE OR REPLACE` de esa
-- función) a propósito: esa función tiene ~200 líneas de borrado por FK que
-- no hace falta duplicar acá, y una migración que reescribe una función ya
-- pusheada arriesga divergir con lo que corre en producción si algo falla
-- a mitad de camino. El cliente la llama DESPUÉS de que los 7 pasos de
-- `purge_household_step` terminaron bien (ver `runPurge` en
-- `/more/data/page.tsx`), nunca antes.
--
-- Riesgo conocido y aceptado: si el cliente se cae entre el paso 7 y esta
-- llamada, ningún otro dispositivo se entera. No hace falta una segunda
-- ruta de recuperación — los 7 pasos y esta función son idempotentes
-- (correr el purge de nuevo sobre un household ya vacío no rompe nada,
-- solo confirma el marcador), así que basta con que el usuario vuelva a
-- tocar "Borrar todos mis datos" una vez.
-- Devuelve el `purged_at` que acaba de escribir (no `void`): el cliente lo
-- usa como valor EXACTO del marcador local (`purgeAppliedKeyFor`,
-- `purge-reconcile.ts`), en vez de aproximarlo con su propio reloj — dos
-- relojes que no coinciden harían que el próximo pull en el MISMO
-- dispositivo creyera que todavía hay un purge sin reconciliar y repitiera
-- el wipe (inofensivo por ser idempotente, pero innecesario).
CREATE FUNCTION public.purge_household_finish(p_household_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_purged_at timestamptz := now();
BEGIN
  IF NOT public.is_household_owner(p_household_id) THEN
    RAISE EXCEPTION 'Solo el owner del household puede borrar sus datos';
  END IF;

  UPDATE public.households
  SET purged_at = v_purged_at, updated_at = v_purged_at
  WHERE id = p_household_id;

  RETURN v_purged_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_household_finish(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_household_finish(uuid) TO authenticated;
