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
    const db = getDb();
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
    // C4 — el enqueue vive en la MISMA transacción que la escritura: un
    // crash entre el commit y el enqueue dejaba la cuenta local sin
    // entrada de outbox, sin reconciliación posible.
    await db.transaction("rw", db.accounts, db.outbox, async () => {
      await db.accounts.add(row);
      await outbox.enqueue({ table: "accounts", op: "insert", entityId: row.id, payload: row, clientRev: 1 });
    });
    return row;
  },

  async update(id: string, patch: Partial<AccountRow>): Promise<void> {
    await enqueueAccountWrite(id, { ...patch, updatedAt: nowIso() });
  },

  async archive(id: string): Promise<void> {
    await enqueueAccountWrite(id, { archivedAt: nowIso(), updatedAt: nowIso() });
  },

  async softDelete(id: string): Promise<void> {
    await enqueueAccountWrite(id, { deletedAt: nowIso(), updatedAt: nowIso() });
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

/** Aplica `patch` y encola dentro de la misma transacción Dexie (C4). */
async function enqueueAccountWrite(id: string, patch: Partial<AccountRow>): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.accounts, db.outbox, async () => {
    await db.accounts.update(id, patch);
    const row = await db.accounts.get(id);
    if (!row) return;
    await outbox.enqueue({ table: "accounts", op: "update", entityId: id, payload: row, clientRev: 1 });
  });
}
