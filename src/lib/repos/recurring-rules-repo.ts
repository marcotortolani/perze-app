import { getDb } from "../db/client";
import type { RecurringRuleRow } from "../db/schema";
import { outbox } from "../offline/outbox";
import { newId, nowIso } from "./ids";

export type NewRecurringRuleInput = Omit<RecurringRuleRow, "id" | "archivedAt" | "createdAt" | "updatedAt" | "clientRev">;

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
    const row: RecurringRuleRow = { ...input, id: newId(), archivedAt: null, createdAt: now, updatedAt: now, clientRev: 1 };
    // C4 — enqueue en la misma transacción que la escritura (ver nota en accounts-repo.ts).
    await db.transaction("rw", db.recurringRules, db.outbox, async () => {
      await db.recurringRules.add(row);
      await outbox.enqueue({ table: "recurring_rules", op: "insert", entityId: row.id, payload: row, clientRev: row.clientRev });
    });
    return row;
  },

  async update(id: string, patch: Partial<RecurringRuleRow>): Promise<void> {
    const db = getDb();
    // C10 — clientRev real, ver la nota en accounts-repo.ts.
    await db.transaction("rw", db.recurringRules, db.outbox, async () => {
      const existing = await db.recurringRules.get(id);
      if (!existing) return;
      const nextRev = existing.clientRev + 1;
      const updated: RecurringRuleRow = { ...existing, ...patch, updatedAt: nowIso(), clientRev: nextRev };
      await db.recurringRules.put(updated);
      await outbox.enqueue({ table: "recurring_rules", op: "update", entityId: id, payload: updated, clientRev: nextRev });
    });
  },

  async archive(id: string): Promise<void> {
    await this.update(id, { archivedAt: nowIso() });
  },
};
