import { getDb } from "../db/client";
import type { AccountRow } from "../db/schema";
import { outbox } from "../offline/outbox";
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

  /** `null`, no `undefined` — TanStack Query no acepta que un `queryFn` resuelva `undefined` (ver `useAccount`). */
  async get(id: string): Promise<AccountRow | null> {
    return (await getDb().accounts.get(id)) ?? null;
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
    await outbox.enqueue({ table: "accounts", op: "insert", entityId: row.id, payload: row, clientRev: 1 });
    return row;
  },

  async update(id: string, patch: Partial<AccountRow>): Promise<void> {
    await getDb().accounts.update(id, { ...patch, updatedAt: nowIso() });
    await enqueueAccountUpdate(id);
  },

  async archive(id: string): Promise<void> {
    await getDb().accounts.update(id, { archivedAt: nowIso(), updatedAt: nowIso() });
    await enqueueAccountUpdate(id);
  },

  async softDelete(id: string): Promise<void> {
    await getDb().accounts.update(id, { deletedAt: nowIso(), updatedAt: nowIso() });
    await enqueueAccountUpdate(id);
  },

  /**
   * Aplica un delta de saldo — lo usa `transactionsRepo` dentro de su
   * transacción de Dexie. Nunca encola: `current_balance` no se
   * sincroniza (lo recalcula el trigger de Postgres a partir de las
   * transactions ya sincronizadas), así que esto es puro bookkeeping local
   * para que la UI muestre el saldo correcto sin esperar una vuelta de red.
   */
  async applyBalanceDelta(id: string, delta: bigint): Promise<void> {
    const account = await getDb().accounts.get(id);
    if (!account) throw new Error(`Cuenta ${id} no encontrada`);
    await getDb().accounts.update(id, {
      currentBalance: account.currentBalance + delta,
      updatedAt: nowIso(),
    });
  },
};

async function enqueueAccountUpdate(id: string): Promise<void> {
  const row = await getDb().accounts.get(id);
  if (!row) return;
  await outbox.enqueue({ table: "accounts", op: "update", entityId: id, payload: row, clientRev: 1 });
}
