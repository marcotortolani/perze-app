import { createClient } from "../supabase/client";
import { getDb } from "../db/client";
import { purgeAppliedKeyFor } from "../offline/purge-reconcile";
import { wipeLocalHouseholdData } from "./purge-household-local";

// Reexportada — sigue viviendo en `purge-household-local.ts` (100% Dexie,
// testeable sin arrastrar la validación de env vars de Supabase que dispara
// `createClient()`), pero todo lo que ya la importaba de acá (`/more/data/page.tsx`)
// no tiene que cambiar.
export { wipeLocalHouseholdData };

export type PurgeStepKey =
  | "transactions"
  | "investments"
  | "recurring_debts"
  | "budgets_goals"
  | "accounts"
  | "categories_rules"
  | "fx_prefs";

export interface PurgeStep {
  key: PurgeStepKey;
  labelKey: string;
}

/**
 * Orden real de borrado en el servidor — respeta las FK del esquema
 * (ninguna tabla de household tiene `ON DELETE CASCADE`, así que el orden
 * entre pasos importa: `transactions`/`investments`/`recurring_debts`/
 * `budgets_goals` antes que `accounts`, porque todos tienen una FK
 * `account_id` que apunta ahí — ver el comentario completo en
 * `20260804000000_purge_household.sql`). No reordenar sin revisar esa
 * migración.
 */
export const PURGE_STEPS: PurgeStep[] = [
  { key: "transactions", labelKey: "dataPage.purge.steps.transactions" },
  { key: "investments", labelKey: "dataPage.purge.steps.investments" },
  { key: "recurring_debts", labelKey: "dataPage.purge.steps.recurringDebts" },
  { key: "budgets_goals", labelKey: "dataPage.purge.steps.budgetsGoals" },
  { key: "accounts", labelKey: "dataPage.purge.steps.accounts" },
  { key: "categories_rules", labelKey: "dataPage.purge.steps.categoriesRules" },
  { key: "fx_prefs", labelKey: "dataPage.purge.steps.fxPrefs" },
];

/** Un paso — `purge_household_step` (SECURITY DEFINER) valida que el caller sea owner y devuelve cuántas filas borró. */
export async function runPurgeStep(householdId: string, step: PurgeStepKey): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("purge_household_step", { p_household_id: householdId, p_step: step });
  if (error) throw error;
  return Number(data ?? 0);
}

/**
 * Se llama DESPUÉS de que los 7 pasos terminaron bien — nunca antes, mismo
 * criterio que `wipeLocalHouseholdData`. Estampa `households.purged_at`
 * (`purge_household_finish`, `20260811210000_household_purge_marker.sql`),
 * para que cualquier OTRO dispositivo se entere en su próximo pull y limpie
 * su propio Dexie (`reconcileRemotePurge`, `purge-reconcile.ts`) — sin esto,
 * `transactions` es la única tabla que un segundo dispositivo nunca poda:
 * el pull incremental depende de soft-deletes y el purge hace `DELETE`
 * real.
 *
 * También escribe el marcador LOCAL con el `purged_at` exacto que devolvió
 * el servidor, para que el próximo pull en ESTE MISMO dispositivo (que ya
 * limpió su Dexie de forma síncrona en `runPurge`) no vuelva a repetir el
 * wipe en vano.
 */
export async function finishPurge(householdId: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("purge_household_finish", { p_household_id: householdId });
  if (error) throw error;
  await getDb().meta.put({ key: purgeAppliedKeyFor(householdId), value: data as string });
  await getDb().meta.delete(pendingPurgeFinishKeyFor(householdId));
}

export function pendingPurgeFinishKeyFor(householdId: string): string {
  return `purgeFinishPending:${householdId}`;
}

/**
 * Se escribe DESPUÉS de `wipeLocalHouseholdData` (el borrado local ya es
 * irreversible en ese punto) y ANTES de intentar `finishPurge` — vive en
 * `meta`, así que sobrevive a un reload o a que el usuario cierre la
 * pestaña. Existe porque `finishPurge` puede fallar (red, timeout del RPC)
 * y ANTES ese error se tragaba en silencio (`.catch(() => {})` en
 * `runPurge`, `/more/data/page.tsx`): `households.purged_at` quedaba
 * `null` para siempre, y como `reconcileRemotePurge` es el ÚNICO mecanismo
 * por el que cualquier OTRO dispositivo se entera de que hubo un purge,
 * ese household quedaba sin ninguna forma de recuperarse — cualquier otro
 * dispositivo (o esta misma pestaña reabierta días después) sigue
 * mostrando movimientos que el servidor ya borró de verdad, para siempre.
 */
export async function markPurgeFinishPending(householdId: string): Promise<void> {
  await getDb().meta.put({ key: pendingPurgeFinishKeyFor(householdId), value: true });
}

/**
 * Reintento automático, pensado para correr en cada tick de
 * `useSyncLoop` — no depende de que el usuario vuelva a `/more/data` ni
 * de que note un error. Sin marcador pendiente, no hace nada (el caso
 * normal). Con marcador, reintenta `finishPurge`: `purge_household_finish`
 * no chequea el valor previo, siempre pisa `purged_at` con un `now()`
 * fresco, pero eso es inofensivo de reintentar — cada llamada exitosa
 * limpia el marcador local, así que en régimen normal esto llama a lo
 * sumo una vez. Si vuelve a fallar, el marcador queda puesto para el
 * próximo tick.
 */
export async function retryPendingPurgeFinish(householdId: string): Promise<void> {
  const pending = await getDb().meta.get(pendingPurgeFinishKeyFor(householdId));
  if (!pending) return;
  await finishPurge(householdId);
}

