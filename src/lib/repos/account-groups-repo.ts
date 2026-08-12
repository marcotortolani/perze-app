import { getDb } from "../db/client";
import type { AccountGroupRow } from "../db/schema";
import { outbox } from "../offline/outbox";
import { newId, nowIso } from "./ids";

export type NewAccountGroupInput = Omit<AccountGroupRow, "id" | "createdAt" | "updatedAt" | "deletedAt" | "clientRev">;

/**
 * Repositorio de `account_groups` (Tanda 4 — tarjeta multi-moneda). Mismo
 * patrón que `accounts-repo.ts`: outbox en la misma transacción de Dexie,
 * `clientRev` real para que `conflictSensitive` pueda detectar algo.
 */
export const accountGroupsRepo = {
  async list(householdId: string): Promise<AccountGroupRow[]> {
    const rows = await getDb().accountGroups.where("householdId").equals(householdId).toArray();
    return rows.filter((g) => g.deletedAt === null);
  },

  async get(id: string): Promise<AccountGroupRow | null> {
    return (await getDb().accountGroups.get(id)) ?? null;
  },

  async create(input: NewAccountGroupInput): Promise<AccountGroupRow> {
    const db = getDb();
    const now = nowIso();
    const row: AccountGroupRow = {
      ...input,
      id: newId(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      clientRev: 1,
    };
    await db.transaction("rw", db.accountGroups, db.outbox, async () => {
      await db.accountGroups.add(row);
      await outbox.enqueue({ table: "account_groups", op: "insert", entityId: row.id, payload: row, clientRev: row.clientRev });
    });
    return row;
  },

  async update(id: string, patch: Partial<AccountGroupRow>): Promise<void> {
    const db = getDb();
    await db.transaction("rw", db.accountGroups, db.outbox, async () => {
      const existing = await db.accountGroups.get(id);
      if (!existing) throw new Error(`Grupo de cuentas ${id} no encontrado`);
      const nextRev = existing.clientRev + 1;
      const updated: AccountGroupRow = { ...existing, ...patch, updatedAt: nowIso(), clientRev: nextRev };
      await db.accountGroups.put(updated);
      await outbox.enqueue({ table: "account_groups", op: "update", entityId: id, payload: updated, clientRev: nextRev });
    });
  },

  async archive(id: string): Promise<void> {
    await accountGroupsRepo.update(id, { archivedAt: nowIso() });
  },
};
