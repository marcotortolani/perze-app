import { getDb } from "../db/client";
import type { TransactionRow } from "../db/schema";
import {
  computeTransactionEffects,
  mergeEffectsByAccount,
  reverseEffects,
} from "./balance-effects";
import { newId, nowIso } from "./ids";

export type NewTransactionInput = Omit<
  TransactionRow,
  "id" | "createdAt" | "updatedAt" | "deletedAt" | "clientRev"
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

  async get(id: string): Promise<TransactionRow | undefined> {
    return getDb().transactions.get(id);
  },

  /** Movimientos con `fxRate === null` — el estado `needs_fx` (doc 01 § 2.5). */
  async listNeedingFx(householdId: string): Promise<TransactionRow[]> {
    const rows = await getDb().transactions.where("householdId").equals(householdId).toArray();
    return rows.filter((t) => t.deletedAt === null && t.fxRate === null);
  },

  async create(input: NewTransactionInput): Promise<TransactionRow> {
    const db = getDb();
    const now = nowIso();
    const row: TransactionRow = { ...input, id: newId(), clientRev: input.clientRev ?? 1, createdAt: now, updatedAt: now, deletedAt: null };

    await db.transaction("rw", db.transactions, db.accounts, async () => {
      await db.transactions.add(row);
      const effects = computeTransactionEffects(row);
      for (const [accountId, delta] of mergeEffectsByAccount(effects)) {
        await bumpBalance(accountId, delta);
      }
    });

    return row;
  },

  async update(id: string, patch: Partial<TransactionRow>): Promise<TransactionRow> {
    const db = getDb();
    let updated!: TransactionRow;

    await db.transaction("rw", db.transactions, db.accounts, async () => {
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
    });

    return updated;
  },

  /** Borrado reversible (swipe + "Deshacer" 5s) — nunca un diálogo de confirmación. */
  async softDelete(id: string): Promise<void> {
    const db = getDb();
    await db.transaction("rw", db.transactions, db.accounts, async () => {
      const existing = await db.transactions.get(id);
      if (!existing || existing.deletedAt !== null) return;

      await db.transactions.update(id, { deletedAt: nowIso(), updatedAt: nowIso() });
      const reversed = reverseEffects(computeTransactionEffects(existing));
      for (const [accountId, delta] of mergeEffectsByAccount(reversed)) {
        await bumpBalance(accountId, delta);
      }
    });
  },

  /** Deshacer el borrado — reaplica el efecto original. */
  async restore(id: string): Promise<void> {
    const db = getDb();
    await db.transaction("rw", db.transactions, db.accounts, async () => {
      const existing = await db.transactions.get(id);
      if (!existing || existing.deletedAt === null) return;

      await db.transactions.update(id, { deletedAt: null, updatedAt: nowIso() });
      const effects = computeTransactionEffects(existing);
      for (const [accountId, delta] of mergeEffectsByAccount(effects)) {
        await bumpBalance(accountId, delta);
      }
    });
  },
};

async function bumpBalance(accountId: string, delta: bigint): Promise<void> {
  const db = getDb();
  const account = await db.accounts.get(accountId);
  if (!account) throw new Error(`Cuenta ${accountId} no encontrada`);
  await db.accounts.update(accountId, { currentBalance: account.currentBalance + delta, updatedAt: nowIso() });
}
