import { getDb } from "../db/client";
import type { TransactionRow } from "../db/schema";
import { outbox } from "../offline/outbox";
import {
  computeTransactionEffects,
  mergeEffectsByAccount,
  reverseEffects,
} from "./balance-effects";
import { newId, nowIso } from "./ids";

/**
 * C4 — encola dentro de la MISMA transacción Dexie que escribe la fila
 * (el caller la llama desde dentro de un `db.transaction(...)` que ya
 * declaró `db.outbox` entre sus tablas). Antes, el enqueue corría después
 * de que la transacción ya había hecho commit: un crash o cierre de
 * pestaña entre el commit y el enqueue dejaba la fila local sin entrada de
 * outbox — existe en el dispositivo pero nunca va a existir en el
 * servidor, sin reconciliación posible.
 */
async function enqueueTransaction(op: "insert" | "update" | "delete", row: TransactionRow): Promise<void> {
  await outbox.enqueue({ table: "transactions", op, entityId: row.id, payload: row, clientRev: row.clientRev });
}

export type NewTransactionInput = Omit<
  TransactionRow,
  "id" | "createdAt" | "updatedAt" | "deletedAt" | "clientRev" | "syncState" | "syncError"
> & { clientRev?: number };

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  from?: string; // ISO datetime, inclusivo
  to?: string; // ISO datetime, exclusivo
}

/**
 * Repositorio de movimientos. El invariante duro: **guardar no puede
 * fallar** (`docs/perze-plan-redesign-first-5-blocks.md` § Fase 5) — todo
 * lo de acá es local (Dexie), la red es un detalle de otra capa
 * (`lib/offline/outbox`).
 */
export const transactionsRepo = {
  async list(householdId: string, filters: TransactionFilters = {}): Promise<TransactionRow[]> {
    const db = getDb();
    let rows: TransactionRow[];

    if (filters.from !== undefined || filters.to !== undefined) {
      const lower = [householdId, filters.from ?? ""];
      const upper = [householdId, filters.to ?? "￿"];
      rows = await db.transactions.where("[householdId+occurredAt]").between(lower, upper).toArray();
    } else {
      rows = await db.transactions.where("householdId").equals(householdId).toArray();
    }

    return rows
      .filter((t) => t.deletedAt === null)
      .filter((t) => filters.accountId === undefined || t.accountId === filters.accountId)
      .filter((t) => filters.categoryId === undefined || t.categoryId === filters.categoryId)
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
  },

  /** `null`, no `undefined` — TanStack Query no acepta que un `queryFn` resuelva `undefined` (ver `useTransaction`). */
  async get(id: string): Promise<TransactionRow | null> {
    return (await getDb().transactions.get(id)) ?? null;
  },

  /** Movimientos con `fxRate === null` — el estado `needs_fx` (doc 01 § 2.5). */
  async listNeedingFx(householdId: string): Promise<TransactionRow[]> {
    const rows = await getDb().transactions.where("householdId").equals(householdId).toArray();
    return rows.filter((t) => t.deletedAt === null && t.fxRate === null);
  },

  /** G2 — historial de una regla recurrente, ordenado por fecha (incluye soft-deleted, `recurring-history.ts` los filtra). */
  async listByRecurringId(recurringId: string): Promise<TransactionRow[]> {
    const rows = await getDb().transactions.where("recurringId").equals(recurringId).toArray();
    return rows.sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1));
  },

  async create(input: NewTransactionInput): Promise<TransactionRow> {
    const db = getDb();
    const now = nowIso();
    const row: TransactionRow = { ...input, id: newId(), clientRev: input.clientRev ?? 1, createdAt: now, updatedAt: now, deletedAt: null, syncState: "ok", syncError: null };

    await db.transaction("rw", db.transactions, db.accounts, db.outbox, async () => {
      await db.transactions.add(row);
      const effects = computeTransactionEffects(row);
      for (const [accountId, delta] of mergeEffectsByAccount(effects)) {
        await bumpBalance(accountId, delta);
      }
      await enqueueTransaction("insert", row);
    });

    return row;
  },

  async update(id: string, patch: Partial<TransactionRow>): Promise<TransactionRow> {
    const db = getDb();
    let updated!: TransactionRow;

    await db.transaction("rw", db.transactions, db.accounts, db.outbox, async () => {
      const existing = await db.transactions.get(id);
      if (!existing) throw new Error(`Movimiento ${id} no encontrado`);

      updated = { ...existing, ...patch, updatedAt: nowIso(), clientRev: existing.clientRev + 1 };

      const oldEffects = existing.deletedAt === null ? computeTransactionEffects(existing) : [];
      const newEffects = updated.deletedAt === null ? computeTransactionEffects(updated) : [];
      const net = mergeEffectsByAccount([...reverseEffects(oldEffects), ...newEffects]);

      await db.transactions.put(updated);
      for (const [accountId, delta] of net) {
        if (delta !== 0n) await bumpBalance(accountId, delta);
      }
      await enqueueTransaction("update", updated);
    });

    return updated;
  },

  /** Borrado reversible (swipe + "Deshacer" 5s) — nunca un diálogo de confirmación. */
  async softDelete(id: string): Promise<void> {
    const db = getDb();
    let updated: TransactionRow | undefined;
    await db.transaction("rw", db.transactions, db.accounts, db.outbox, async () => {
      const existing = await db.transactions.get(id);
      if (!existing || existing.deletedAt !== null) return;

      const patch = { deletedAt: nowIso(), updatedAt: nowIso(), clientRev: existing.clientRev + 1 };
      await db.transactions.update(id, patch);
      updated = { ...existing, ...patch };
      const reversed = reverseEffects(computeTransactionEffects(existing));
      for (const [accountId, delta] of mergeEffectsByAccount(reversed)) {
        await bumpBalance(accountId, delta);
      }
      await enqueueTransaction("update", updated);
    });
  },

  /**
   * Recurrentes v3 — cuando el motor cliente materializa offline y el cron
   * ya insertó la misma ocurrencia server-side, el outbox recibe un 23505
   * sobre `transactions_recurring_occurrence_uniq` (`sync-worker.ts`). La
   * fila optimista local perdió la carrera: se revierte su efecto de saldo
   * y se borra de Dexie sin pasar por el outbox — la fila real llega sola
   * en el próximo pull. A diferencia de `softDelete`, esto no es
   * reversible ni encola nada: la fila nunca llegó a existir en el
   * servidor con este id.
   */
  async discardLocal(id: string): Promise<void> {
    const db = getDb();
    await db.transaction("rw", db.transactions, db.accounts, async () => {
      const existing = await db.transactions.get(id);
      if (!existing) return;
      if (existing.deletedAt === null) {
        const reversed = reverseEffects(computeTransactionEffects(existing));
        for (const [accountId, delta] of mergeEffectsByAccount(reversed)) {
          await bumpBalance(accountId, delta);
        }
      }
      await db.transactions.delete(id);
    });
  },

  /** Deshacer el borrado — reaplica el efecto original. */
  async restore(id: string): Promise<void> {
    const db = getDb();
    let restored: TransactionRow | undefined;
    await db.transaction("rw", db.transactions, db.accounts, db.outbox, async () => {
      const existing = await db.transactions.get(id);
      if (!existing || existing.deletedAt === null) return;

      const patch = { deletedAt: null, updatedAt: nowIso(), clientRev: existing.clientRev + 1 };
      await db.transactions.update(id, patch);
      restored = { ...existing, ...patch };
      const effects = computeTransactionEffects(existing);
      for (const [accountId, delta] of mergeEffectsByAccount(effects)) {
        await bumpBalance(accountId, delta);
      }
      await enqueueTransaction("update", restored);
    });
  },
};

async function bumpBalance(accountId: string, delta: bigint): Promise<void> {
  const db = getDb();
  const account = await db.accounts.get(accountId);
  if (!account) throw new Error(`Cuenta ${accountId} no encontrada`);
  await db.accounts.update(accountId, { currentBalance: account.currentBalance + delta, updatedAt: nowIso() });
}
