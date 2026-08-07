import { getDb } from "../db/client";
import type { ConflictRecordRow, TransactionRow } from "../db/schema";
import { outbox } from "../offline/outbox";
import { nowIso } from "./ids";

function bigintOrNull(value: unknown): bigint | null {
  return value === null || value === undefined ? null : BigInt(value as string);
}

/** El servidor guarda `transactions` en snake_case con bigint como string — la vuelta exacta de `sync-config.ts#toRow`. */
function fromServerTransaction(server: Record<string, unknown>): TransactionRow {
  return {
    id: server.id as string,
    householdId: server.household_id as string,
    createdBy: server.created_by as string,
    kind: server.kind as TransactionRow["kind"],
    occurredAt: server.occurred_at as string,
    accountId: server.account_id as string,
    counterAccountId: server.counter_account_id as string | null,
    amount: BigInt(server.amount as string),
    currencyCode: server.currency_code as string,
    originalAmount: bigintOrNull(server.original_amount),
    originalCurrency: server.original_currency as string | null,
    originalRate: bigintOrNull(server.original_rate),
    fxRate: bigintOrNull(server.fx_rate),
    fxSource: server.fx_source as TransactionRow["fxSource"],
    fxProvider: server.fx_provider as string | null,
    fxQuoteKind: server.fx_quote_kind as string | null,
    fxResolvedAt: server.fx_resolved_at as string | null,
    amountBase: bigintOrNull(server.amount_base),
    counterAmount: bigintOrNull(server.counter_amount),
    counterCurrencyCode: server.counter_currency_code as string | null,
    counterFxRate: bigintOrNull(server.counter_fx_rate),
    categoryId: server.category_id as string | null,
    payeeId: server.payee_id as string | null,
    note: server.note as string | null,
    attachments: (server.attachments as TransactionRow["attachments"]) ?? [],
    location: server.location as TransactionRow["location"],
    status: server.status as TransactionRow["status"],
    visibility: server.visibility as TransactionRow["visibility"],
    recurringId: server.recurring_id as string | null,
    recurringOccurrenceDate: server.recurring_occurrence_date as string | null,
    installmentGroupId: server.installment_group_id as string | null,
    installmentNumber: server.installment_number as number | null,
    installmentTotal: server.installment_total as number | null,
    createdAt: server.created_at as string,
    updatedAt: server.updated_at as string,
    deletedAt: server.deleted_at as string | null,
    clientRev: server.client_rev as number,
    source: server.source as TransactionRow["source"],
    syncState: "ok",
    syncError: null,
  };
}

/**
 * CQ — resolución de conflictos de sync. Solo cubre `transactions` (la
 * única tabla marcada `conflictSensitive` en `sync-config.ts` hoy) — ver
 * la nota ahí sobre por qué el resto no lo necesita todavía.
 */
export const conflictsRepo = {
  async listForHousehold(householdId: string): Promise<ConflictRecordRow[]> {
    const all = await getDb().conflicts.toArray();
    return all.filter((c) => c.table === "transactions" && (c.localPayload as { householdId?: string }).householdId === householdId);
  },

  /** Se queda con la edición local: la vuelve a subir como si acabara de editarse sobre la revisión actual del servidor. */
  async keepLocal(conflict: ConflictRecordRow): Promise<void> {
    const db = getDb();
    const serverRev = (conflict.serverPayload.client_rev as number | undefined) ?? 0;
    const nextRev = serverRev + 1;
    const local = conflict.localPayload as unknown as TransactionRow;
    const updated: TransactionRow = { ...local, clientRev: nextRev, syncState: "ok", syncError: null, updatedAt: nowIso() };
    // C4 — enqueue en la misma transacción que la escritura (ver nota en accounts-repo.ts).
    await db.transaction("rw", db.transactions, db.outbox, db.conflicts, async () => {
      await db.transactions.put(updated);
      await outbox.enqueue({ table: "transactions", op: "update", entityId: conflict.entityId, payload: updated, clientRev: nextRev });
      await db.conflicts.delete(conflict.id);
    });
  },

  /** Se queda con la versión del servidor: pisa la fila local con lo que ya ganó del otro lado. */
  async keepServer(conflict: ConflictRecordRow): Promise<void> {
    const db = getDb();
    const serverRow = fromServerTransaction(conflict.serverPayload);
    await db.transactions.put(serverRow);
    await db.conflicts.delete(conflict.id);
  },
};
