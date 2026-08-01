import { getDb } from "../db/client";
import type { RecurringRuleRow } from "../db/schema";
import { outbox } from "../offline/outbox";
import { newId, nowIso } from "./ids";

export type NewRecurringRuleInput = Omit<RecurringRuleRow, "id" | "archivedAt" | "createdAt" | "updatedAt">;

export const recurringRulesRepo = {
  async list(householdId: string): Promise<RecurringRuleRow[]> {
    const rows = await getDb().recurringRules.where("householdId").equals(householdId).toArray();
    return rows.filter((r) => r.archivedAt === null);
  },

  async get(id: string): Promise<RecurringRuleRow | undefined> {
    return getDb().recurringRules.get(id);
  },

  async create(input: NewRecurringRuleInput): Promise<RecurringRuleRow> {
    const db = getDb();
    const now = nowIso();
    const row: RecurringRuleRow = { ...input, id: newId(), archivedAt: null, createdAt: now, updatedAt: now };
    // C4 — enqueue en la misma transacción que la escritura (ver nota en accounts-repo.ts).
    await db.transaction("rw", db.recurringRules, db.outbox, async () => {
      await db.recurringRules.add(row);
      await outbox.enqueue({ table: "recurring_rules", op: "insert", entityId: row.id, payload: row, clientRev: 1 });
    });
    return row;
  },

  async update(id: string, patch: Partial<RecurringRuleRow>): Promise<void> {
    const db = getDb();
    await db.transaction("rw", db.recurringRules, db.outbox, async () => {
      await db.recurringRules.update(id, { ...patch, updatedAt: nowIso() });
      const row = await db.recurringRules.get(id);
      if (row) await outbox.enqueue({ table: "recurring_rules", op: "update", entityId: id, payload: row, clientRev: 1 });
    });
  },

  async archive(id: string): Promise<void> {
    await this.update(id, { archivedAt: nowIso() });
  },
};
