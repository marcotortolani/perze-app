import { getDb } from "../db/client";
import { wipeLocalHouseholdData } from "../repos/purge-household-local";

/**
 * Marca, en `meta`, la última vez que ESTE dispositivo limpió su Dexie a
 * causa de un purge remoto — separado del `pullWatermark` (que
 * `wipeLocalHouseholdData` ya borra) porque este otro semáforo tiene que
 * SOBREVIVIR al wipe: es lo que evita limpiar de nuevo en el próximo tick
 * de sync si `purged_at` no cambió.
 */
export function purgeAppliedKeyFor(householdId: string): string {
  return `purgeApplied:${householdId}`;
}

/**
 * Si `purgedAt` (el `households.purged_at` que `pull.ts` acaba de bajar) es
 * más nuevo que la última vez que este dispositivo reaccionó a un purge,
 * vacía Dexie con la misma rutina que corre el dispositivo que ejecutó
 * "Borrar todos mis datos" (`wipeLocalHouseholdData`) y actualiza el
 * marcador. Devuelve `true` si limpió algo.
 *
 * El dispositivo que INICIÓ el purge ya limpió su Dexie de forma síncrona,
 * ni bien los 7 pasos remotos terminaron (`runPurge` en `/more/data/page.tsx`),
 * y escribe el mismo marcador ahí mismo — así que cuando le toque a ESE
 * dispositivo pasar por acá en el próximo pull, el marcador ya está al día
 * y esta función no hace nada. Quien de verdad necesita esto es CUALQUIER
 * OTRO dispositivo logueado en el mismo household.
 */
export async function reconcileRemotePurge(householdId: string, purgedAt: string | null): Promise<boolean> {
  if (!purgedAt) return false;
  const db = getDb();
  const key = purgeAppliedKeyFor(householdId);
  const applied = (await db.meta.get(key))?.value as string | undefined;
  if (applied && applied >= purgedAt) return false;
  await wipeLocalHouseholdData(householdId);
  await db.meta.put({ key, value: purgedAt });
  return true;
}
