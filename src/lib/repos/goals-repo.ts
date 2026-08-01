import { getDb } from "../db/client";
import type { GoalRow } from "../db/schema";
import { outbox } from "../offline/outbox";
import { newId, nowIso } from "./ids";

export type NewGoalInput = Omit<GoalRow, "id" | "archivedAt" | "createdAt" | "updatedAt">;

export const goalsRepo = {
  async list(householdId: string): Promise<GoalRow[]> {
    const rows = await getDb().goals.where("householdId").equals(householdId).toArray();
    return rows.filter((g) => g.archivedAt === null);
  },

  async get(id: string): Promise<GoalRow | undefined> {
    return getDb().goals.get(id);
  },

  async create(input: NewGoalInput): Promise<GoalRow> {
    const now = nowIso();
    const row: GoalRow = { ...input, id: newId(), archivedAt: null, createdAt: now, updatedAt: now };
    await getDb().goals.add(row);
    await outbox.enqueue({ table: "goals", op: "insert", entityId: row.id, payload: row, clientRev: 1 });
    return row;
  },

  async update(id: string, patch: Partial<GoalRow>): Promise<void> {
    await getDb().goals.update(id, { ...patch, updatedAt: nowIso() });
    const row = await getDb().goals.get(id);
    if (row) await outbox.enqueue({ table: "goals", op: "update", entityId: id, payload: row, clientRev: 1 });
  },

  async archive(id: string): Promise<void> {
    await this.update(id, { archivedAt: nowIso() });
  },
};
