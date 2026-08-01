import { getDb } from "../db/client";
import type { AccountRow } from "../db/schema";
import { outbox } from "../offline/outbox";
import { newId, nowIso } from "./ids";

export type NewAccountInput = Omit<
  AccountRow,
  "id" | "currentBalance" | "createdAt" | "updatedAt" | "deletedAt" | "sortOrder" | "clientRev"
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
      clientRev: 1,
    };
    await getDb().accounts.add(row);
    await outbox.enqueue({ table: "accounts", op: "insert", entityId: row.id, payload: row, clientRev: row.clientRev });
    return row;
  },

  async update(id: string, patch: Partial<AccountRow>): Promise<void> {
    await enqueueAccountUpdate(id, patch);
  },

  async archive(id: string): Promise<void> {
    await enqueueAccountUpdate(id, { archivedAt: nowIso() });
  },

  async softDelete(id: string): Promise<void> {
    await enqueueAccountUpdate(id, { deletedAt: nowIso() });
  },

  /**
   * Aplica un delta de saldo — lo usa `transactionsRepo` dentro de su
   * transacción de Dexie. Nunca encola: `current_balance` no se
   * sincroniza (lo recalcula el trigger de Postgres a partir de las
   * transactions ya sincronizadas), así que esto es puro bookkeeping local
   * para que la UI muestre el saldo correcto sin esperar una vuelta de red.
   * Tampoco toca `clientRev`: no es una edición del usuario, es el mismo
   * efecto contable que ya viaja en el outbox de la transacción.
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

/**
 * C10 — `clientRev` real: se lee la fila actual, se incrementa, y el MISMO
 * valor incrementado es el que se persiste en Dexie y el que viaja en el
 * outbox — antes el outbox mandaba siempre `clientRev: 1`, así que
 * `detectRevisionConflict` (`conflict-detection.ts`) nunca podía detectar
 * nada real para esta tabla.
 */
async function enqueueAccountUpdate(id: string, patch: Partial<AccountRow>): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.accounts, db.outbox, async () => {
    const existing = await db.accounts.get(id);
    if (!existing) return;
    const nextRev = existing.clientRev + 1;
    const updated: AccountRow = { ...existing, ...patch, updatedAt: nowIso(), clientRev: nextRev };
    await db.accounts.put(updated);
    await outbox.enqueue({ table: "accounts", op: "update", entityId: id, payload: updated, clientRev: nextRev });
  });
}
