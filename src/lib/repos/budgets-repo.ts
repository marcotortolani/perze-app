import { getDb } from "../db/client";
import type { BudgetRow } from "../db/schema";
import { outbox } from "../offline/outbox";
import { newId, nowIso } from "./ids";

export type NewBudgetInput = Omit<BudgetRow, "id" | "archivedAt" | "createdAt" | "updatedAt" | "clientRev">;

export const budgetsRepo = {
  async list(householdId: string): Promise<BudgetRow[]> {
    const rows = await getDb().budgets.where("householdId").equals(householdId).toArray();
    return rows.filter((b) => b.archivedAt === null);
  },

  async get(id: string): Promise<BudgetRow | undefined> {
    return getDb().budgets.get(id);
  },

  async create(input: NewBudgetInput): Promise<BudgetRow> {
    const db = getDb();
    const now = nowIso();
    const row: BudgetRow = { ...input, id: newId(), archivedAt: null, createdAt: now, updatedAt: now, clientRev: 1 };
    // C4 — enqueue en la misma transacción que la escritura (ver nota en accounts-repo.ts).
    await db.transaction("rw", db.budgets, db.outbox, async () => {
      await db.budgets.add(row);
      await outbox.enqueue({ table: "budgets", op: "insert", entityId: row.id, payload: row, clientRev: row.clientRev });
    });
    return row;
  },

  async update(id: string, patch: Partial<BudgetRow>): Promise<void> {
    const db = getDb();
    // C10 — clientRev real, ver la nota en accounts-repo.ts.
    await db.transaction("rw", db.budgets, db.outbox, async () => {
      const existing = await db.budgets.get(id);
      if (!existing) return;
      const nextRev = existing.clientRev + 1;
      const updated: BudgetRow = { ...existing, ...patch, updatedAt: nowIso(), clientRev: nextRev };
      await db.budgets.put(updated);
      await outbox.enqueue({ table: "budgets", op: "update", entityId: id, payload: updated, clientRev: nextRev });
    });
  },

  /** Apagar oculta, nunca borra — igual que el resto del sistema. */
  async archive(id: string): Promise<void> {
    await this.update(id, { archivedAt: nowIso() });
  },
};
