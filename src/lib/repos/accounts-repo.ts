import { getDb } from "../db/client";
import type { AccountRow } from "../db/schema";
import { newId, nowIso } from "./ids";

export type NewAccountInput = Omit<
  AccountRow,
  "id" | "currentBalance" | "createdAt" | "updatedAt" | "deletedAt" | "sortOrder"
> & { sortOrder?: number };

/**
 * Repositorio de cuentas. Ninguna pantalla toca Dexie directo — esta es la
 * costura que se reemplaza por llamadas a Supabase cuando exista backend.
 */
export const accountsRepo = {
  async list(householdId: string): Promise<AccountRow[]> {
    const rows = await getDb().accounts.where("householdId").equals(householdId).toArray();
    return rows.filter((a) => a.deletedAt === null);
  },

  async get(id: string): Promise<AccountRow | undefined> {
    return getDb().accounts.get(id);
  },

  async create(input: NewAccountInput): Promise<AccountRow> {
    const now = nowIso();
    const row: AccountRow = {
      ...input,
      id: newId(),
      currentBalance: input.openingBalance,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await getDb().accounts.add(row);
    return row;
  },

  async update(id: string, patch: Partial<AccountRow>): Promise<void> {
    await getDb().accounts.update(id, { ...patch, updatedAt: nowIso() });
  },

  async archive(id: string): Promise<void> {
    await getDb().accounts.update(id, { archivedAt: nowIso(), updatedAt: nowIso() });
  },

  async softDelete(id: string): Promise<void> {
    await getDb().accounts.update(id, { deletedAt: nowIso(), updatedAt: nowIso() });
  },

  /** Aplica un delta de saldo — lo usa `transactionsRepo` dentro de su transacción de Dexie. */
  async applyBalanceDelta(id: string, delta: bigint): Promise<void> {
    const account = await getDb().accounts.get(id);
    if (!account) throw new Error(`Cuenta ${id} no encontrada`);
    await getDb().accounts.update(id, {
      currentBalance: account.currentBalance + delta,
      updatedAt: nowIso(),
    });
  },
};
