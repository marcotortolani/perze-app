import { getDb } from "../db/client";
import type { CategoryRow } from "../db/schema";
import { outbox } from "../offline/outbox";
import { newId, nowIso } from "./ids";

export type NewCategoryInput = Omit<
  CategoryRow,
  "id" | "archivedAt" | "createdAt" | "updatedAt" | "deletedAt"
>;

export const categoriesRepo = {
  async list(householdId: string): Promise<CategoryRow[]> {
    const rows = await getDb().categories.where("householdId").equals(householdId).toArray();
    return rows.filter((c) => c.archivedAt === null).sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async get(id: string): Promise<CategoryRow | undefined> {
    return getDb().categories.get(id);
  },

  async create(input: NewCategoryInput): Promise<CategoryRow> {
    const now = nowIso();
    const row: CategoryRow = { ...input, id: newId(), archivedAt: null, createdAt: now, updatedAt: now, deletedAt: null };
    await getDb().categories.add(row);
    await outbox.enqueue({ table: "categories", op: "insert", entityId: row.id, payload: row, clientRev: 1 });
    return row;
  },

  async update(id: string, patch: Partial<CategoryRow>): Promise<void> {
    await getDb().categories.update(id, { ...patch, updatedAt: nowIso() });
    await enqueueCategoryUpdate(id);
  },

  async archive(id: string): Promise<void> {
    await getDb().categories.update(id, { archivedAt: nowIso(), updatedAt: nowIso() });
    await enqueueCategoryUpdate(id);
  },

  async bulkCreate(inputs: NewCategoryInput[]): Promise<CategoryRow[]> {
    const now = nowIso();
    const rows = inputs.map((input) => ({ ...input, id: newId(), archivedAt: null, createdAt: now, updatedAt: now, deletedAt: null }));
    await getDb().categories.bulkAdd(rows);
    for (const row of rows) {
      await outbox.enqueue({ table: "categories", op: "insert", entityId: row.id, payload: row, clientRev: 1 });
    }
    return rows;
  },
};

async function enqueueCategoryUpdate(id: string): Promise<void> {
  const row = await getDb().categories.get(id);
  if (!row) return;
  await outbox.enqueue({ table: "categories", op: "update", entityId: id, payload: row, clientRev: 1 });
}
