import { getDb } from "../db/client";
import type { GoalRow } from "../db/schema";
import { outbox } from "../offline/outbox";
import { newId, nowIso } from "./ids";

export type NewGoalInput = Omit<GoalRow, "id" | "archivedAt" | "createdAt" | "updatedAt" | "clientRev">;

export const goalsRepo = {
  async list(householdId: string): Promise<GoalRow[]> {
    const rows = await getDb().goals.where("householdId").equals(householdId).toArray();
    return rows.filter((g) => g.archivedAt === null);
  },

  async get(id: string): Promise<GoalRow | undefined> {
    return getDb().goals.get(id);
  },

  async create(input: NewGoalInput): Promise<GoalRow> {
    const db = getDb();
    const now = nowIso();
    const row: GoalRow = { ...input, id: newId(), archivedAt: null, createdAt: now, updatedAt: now, clientRev: 1 };
    // C4 — enqueue en la misma transacción que la escritura (ver nota en accounts-repo.ts).
    await db.transaction("rw", db.goals, db.outbox, async () => {
      await db.goals.add(row);
      await outbox.enqueue({ table: "goals", op: "insert", entityId: row.id, payload: row, clientRev: row.clientRev });
    });
    return row;
  },

  async update(id: string, patch: Partial<GoalRow>): Promise<void> {
    const db = getDb();
    // C10 — clientRev real, ver la nota en accounts-repo.ts.
    await db.transaction("rw", db.goals, db.outbox, async () => {
      const existing = await db.goals.get(id);
      if (!existing) return;
      const nextRev = existing.clientRev + 1;
      const updated: GoalRow = { ...existing, ...patch, updatedAt: nowIso(), clientRev: nextRev };
      await db.goals.put(updated);
      await outbox.enqueue({ table: "goals", op: "update", entityId: id, payload: updated, clientRev: nextRev });
    });
  },

  async archive(id: string): Promise<void> {
    await this.update(id, { archivedAt: nowIso() });
  },
};
