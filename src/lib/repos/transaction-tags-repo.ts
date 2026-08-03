import { getDb } from "../db/client";
import type { TransactionTagRow } from "../db/schema";
import { outbox } from "../offline/outbox";

/** `"transactionId:tagId"` — la fila no tiene `id` propio (PK compuesta), ver la nota en `sync-config.ts`/`sync-worker.ts`. */
function entityId(row: TransactionTagRow): string {
  return `${row.transactionId}:${row.tagId}`;
}

export const transactionTagsRepo = {
  async listForTransaction(transactionId: string): Promise<string[]> {
    const rows = await getDb().transactionTags.where("transactionId").equals(transactionId).toArray();
    return rows.map((r) => r.tagId);
  },

  /** Todas las asociaciones de las transacciones dadas — para rankear tags por uso sin una query por movimiento. */
  async listForTransactions(transactionIds: string[]): Promise<TransactionTagRow[]> {
    if (transactionIds.length === 0) return [];
    return getDb().transactionTags.where("transactionId").anyOf(transactionIds).toArray();
  },

  /**
   * Reemplaza el set completo de tags de un movimiento por `tagIds` — la
   * única forma en que la UI edita esto (nunca agrega/saca una por una).
   * Sin `clientRev` real: la fila no tiene campos propios que revisionar,
   * solo existe o no existe (mismo criterio que `householdMembers.addMember`).
   */
  async setForTransaction(transactionId: string, tagIds: string[]): Promise<void> {
    const db = getDb();
    const next = new Set(tagIds);
    await db.transaction("rw", db.transactionTags, db.outbox, async () => {
      const existing = await db.transactionTags.where("transactionId").equals(transactionId).toArray();
      const existingIds = new Set(existing.map((r) => r.tagId));

      for (const row of existing) {
        if (next.has(row.tagId)) continue;
        await db.transactionTags.delete([row.transactionId, row.tagId]);
        await outbox.enqueue({ table: "transaction_tags", op: "delete", entityId: entityId(row), payload: {}, clientRev: 1 });
      }

      for (const tagId of next) {
        if (existingIds.has(tagId)) continue;
        const row: TransactionTagRow = { transactionId, tagId };
        await db.transactionTags.add(row);
        await outbox.enqueue({ table: "transaction_tags", op: "insert", entityId: entityId(row), payload: row, clientRev: 1 });
      }
    });
  },
};
