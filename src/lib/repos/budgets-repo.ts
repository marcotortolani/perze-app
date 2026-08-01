import { getDb } from "../db/client";
import type { BudgetRow } from "../db/schema";
import { outbox } from "../offline/outbox";
import { newId, nowIso } from "./ids";

export type NewBudgetInput = Omit<BudgetRow, "id" | "archivedAt" | "createdAt" | "updatedAt">;

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
    const row: BudgetRow = { ...input, id: newId(), archivedAt: null, createdAt: now, updatedAt: now };
    // C4 — enqueue en la misma transacción que la escritura (ver nota en accounts-repo.ts).
    await db.transaction("rw", db.budgets, db.outbox, async () => {
      await db.budgets.add(row);
      await outbox.enqueue({ table: "budgets", op: "insert", entityId: row.id, payload: row, clientRev: 1 });
    });
    return row;
  },

  async update(id: string, patch: Partial<BudgetRow>): Promise<void> {
    const db = getDb();
    await db.transaction("rw", db.budgets, db.outbox, async () => {
      await db.budgets.update(id, { ...patch, updatedAt: nowIso() });
      const row = await db.budgets.get(id);
      if (row) await outbox.enqueue({ table: "budgets", op: "update", entityId: id, payload: row, clientRev: 1 });
    });
  },

  /** Apagar oculta, nunca borra — igual que el resto del sistema. */
  async archive(id: string): Promise<void> {
    await this.update(id, { archivedAt: nowIso() });
  },
};
