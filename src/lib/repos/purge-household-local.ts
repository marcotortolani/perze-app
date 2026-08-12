import { getDb } from "../db/client";
import { watermarkKeyFor } from "../offline/sync-keys";

/**
 * Borra del outbox toda entrada que apunte a una entidad de ESTE household
 * que `wipeLocalHouseholdData` ya vació de sus tablas propias — sin esto,
 * `drainOutbox` (`use-sync-loop.ts`, corre cada 30s) reinserta en Supabase
 * filas que el purge acaba de borrar del servidor, y el próximo pull las
 * trae de vuelta a Dexie. El outbox NO tiene `householdId` propio (el
 * payload sí, pero un `op: "delete"` lo manda vacío — ver
 * `payees-repo.ts`/`tags-repo.ts`), así que el único ancla confiable es
 * `entityId` contra los ids que se acaban de leer de cada tabla, ANTES de
 * borrarlas.
 *
 * `outbox` no tiene índice sobre `table` (solo `status`/`createdAt`/
 * `entityId`), así que el filtro corre en JS sobre `toCollection()` — mismo
 * patrón que `blockingAccountIds` en `pull.ts`.
 *
 * Caso especial: `transaction_tags` no tiene `id` propio, su `entityId` es
 * `"${transactionId}:${tagId}"` (ver `transaction-tags-repo.ts`) — se
 * matchea por el prefijo del movimiento, no por el id completo.
 */
async function wipeOutboxFor(idsByTable: Record<string, string[]>): Promise<void> {
  const db = getDb();
  const txIds = new Set(idsByTable.transactions ?? []);
  await db.outbox
    .toCollection()
    .filter((entry) => {
      if (entry.table === "transaction_tags") {
        const txId = entry.entityId.split(":")[0];
        return !!txId && txIds.has(txId);
      }
      const ids = idsByTable[entry.table];
      return !!ids && ids.includes(entry.entityId);
    })
    .delete();
}

/**
 * Limpieza del caché local, solo después de que los 7 pasos remotos
 * terminaron bien — nunca antes, para no vaciar Dexie si el borrado
 * remoto todavía puede fallar a mitad de camino. A diferencia de
 * `signOut()` (que tira toda la base con `getDb().delete()`), acá el
 * usuario sigue logueado y en el mismo household: solo se vacían las
 * tablas con datos de ESE household, nunca `households`/`householdMembers`/
 * `profiles`/`currencies`/`countries` ni las filas globales de catálogo.
 *
 * Vive en un módulo propio, separado de `purge-household-repo.ts`: es 100%
 * Dexie, sin ningún import de `createClient()` — eso es lo que permite
 * testearla con `fake-indexeddb` sin arrastrar la validación de env vars de
 * Supabase que dispara `../supabase/client` al importarse (`src/env.ts`
 * revienta en modo test porque `NEXT_PUBLIC_SUPABASE_URL` no se carga en
 * ese modo — ver `purge-household-local.test.ts`). `purge-household-repo.ts`
 * reexporta esta función para no romper a los que ya la importan de ahí.
 *
 * Más allá de las tablas que el purge original ya vaciaba, esto suma:
 * - **`outbox`** (`wipeOutboxFor` arriba) — la resurrección explicada en su
 *   comentario.
 * - **`meta[watermarkKeyFor(householdId)]`** — sin esto, el pull incremental
 *   de `transactions` (`pull.ts`) sigue pidiendo "todo lo nuevo desde la
 *   última vez" con la marca vieja, que ya no significa nada porque el
 *   servidor está vacío; no hay nada que arreglar ahí, pero tampoco hace
 *   daño dejarlo en cero.
 * - **`conflicts`** — filas que apuntan a entidades que ya no existen.
 * - **`fxRates`** — el caché de cotizaciones de ESTE household
 *   (`[householdId+base+quote]`), que no tiene sentido conservar sin las
 *   transacciones que las usaban.
 */
export async function wipeLocalHouseholdData(householdId: string): Promise<void> {
  const db = getDb();

  const txIds = (await db.transactions.where("householdId").equals(householdId).primaryKeys()) as string[];
  const accountIds = (await db.accounts.where("householdId").equals(householdId).primaryKeys()) as string[];
  const categoryIds = (await db.categories.where("householdId").equals(householdId).primaryKeys()) as string[];
  const tagIds = (await db.tags.where("householdId").equals(householdId).primaryKeys()) as string[];
  const payeeIds = (await db.payees.where("householdId").equals(householdId).primaryKeys()) as string[];
  const budgetIds = (await db.budgets.where("householdId").equals(householdId).primaryKeys()) as string[];
  const goalIds = (await db.goals.where("householdId").equals(householdId).primaryKeys()) as string[];
  const recurringRuleIds = (await db.recurringRules.where("householdId").equals(householdId).primaryKeys()) as string[];
  const categorizationRuleIds = (await db.categorizationRules.where("householdId").equals(householdId).primaryKeys()) as string[];

  await db.transactionShares.where("transactionId").anyOf(txIds).delete();
  await db.transactionSplits.where("transactionId").anyOf(txIds).delete();
  await db.transactionTags.where("transactionId").anyOf(txIds).delete();

  await Promise.all([
    db.transactions.where("householdId").equals(householdId).delete(),
    db.settlements.where("householdId").equals(householdId).delete(),
    db.accounts.where("householdId").equals(householdId).delete(),
    db.categories.where("householdId").equals(householdId).delete(),
    db.tags.where("householdId").equals(householdId).delete(),
    db.payees.where("householdId").equals(householdId).delete(),
    db.budgets.where("householdId").equals(householdId).delete(),
    db.goals.where("householdId").equals(householdId).delete(),
    db.recurringRules.where("householdId").equals(householdId).delete(),
    db.categorizationRules.where("householdId").equals(householdId).delete(),
    db.householdFxPreferences.where("householdId").equals(householdId).delete(),
    // Clones del household únicamente — las filas globales (`householdId: null`)
    // del catálogo compartido no matchean `.equals(householdId)`.
    db.institutions.where("householdId").equals(householdId).delete(),
  ]);

  await wipeOutboxFor({
    transactions: txIds,
    accounts: accountIds,
    categories: categoryIds,
    tags: tagIds,
    payees: payeeIds,
    budgets: budgetIds,
    goals: goalIds,
    recurring_rules: recurringRuleIds,
    rules: categorizationRuleIds,
  });

  await db.meta.delete(watermarkKeyFor(householdId));

  const conflictEntityIds = [...txIds, ...accountIds, ...categoryIds, ...tagIds, ...payeeIds, ...budgetIds, ...goalIds, ...recurringRuleIds, ...categorizationRuleIds];
  if (conflictEntityIds.length > 0) {
    await db.conflicts.where("entityId").anyOf(conflictEntityIds).delete();
  }

  // `"", "￿"` como sentinelas de rango — mismo truco que `transactions-repo.ts`
  // (`between([householdId, ""], [householdId, "￿"])`) para "todo lo que
  // empieza con este household", sin depender de `Dexie.minKey`/`maxKey`.
  await db.fxRates.where("[householdId+base+quote]").between([householdId, "", ""], [householdId, "￿", "￿"]).delete();
}
