import { getDb } from "../db/client";
import type { CategorizationRuleRow } from "../db/schema";
import { outbox } from "../offline/outbox";
import { newId, nowIso } from "./ids";

export type NewCategorizationRuleInput = Omit<CategorizationRuleRow, "id" | "hitCount" | "deletedAt" | "createdAt" | "updatedAt">;

export const categorizationRulesRepo = {
  async list(householdId: string): Promise<CategorizationRuleRow[]> {
    const rows = await getDb().categorizationRules.where("householdId").equals(householdId).toArray();
    return rows.filter((r) => r.deletedAt === null).sort((a, b) => b.priority - a.priority);
  },

  async create(input: NewCategorizationRuleInput): Promise<CategorizationRuleRow> {
    const db = getDb();
    const now = nowIso();
    const row: CategorizationRuleRow = { ...input, id: newId(), hitCount: 0, deletedAt: null, createdAt: now, updatedAt: now };
    // C4 — enqueue en la misma transacción que la escritura (ver nota en accounts-repo.ts).
    await db.transaction("rw", db.categorizationRules, db.outbox, async () => {
      await db.categorizationRules.add(row);
      await outbox.enqueue({ table: "rules", op: "insert", entityId: row.id, payload: row, clientRev: 1 });
    });
    return row;
  },

  async update(id: string, patch: Partial<CategorizationRuleRow>): Promise<void> {
    const db = getDb();
    await db.transaction("rw", db.categorizationRules, db.outbox, async () => {
      await db.categorizationRules.update(id, { ...patch, updatedAt: nowIso() });
      const row = await db.categorizationRules.get(id);
      if (row) await outbox.enqueue({ table: "rules", op: "update", entityId: id, payload: row, clientRev: 1 });
    });
  },

  async archive(id: string): Promise<void> {
    await this.update(id, { deletedAt: nowIso() });
  },

  /** Se llama cuando una regla efectivamente categorizó un movimiento — para el badge "9 correcciones sobre 28" de K7. */
  async recordHit(id: string): Promise<void> {
    const row = await getDb().categorizationRules.get(id);
    if (!row) return;
    await this.update(id, { hitCount: row.hitCount + 1 });
  },
};
