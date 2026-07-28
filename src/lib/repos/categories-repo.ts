import { getDb } from "../db/client";
import type { CategoryRow } from "../db/schema";
import { newId } from "./ids";

export type NewCategoryInput = Omit<CategoryRow, "id" | "archivedAt">;

export const categoriesRepo = {
  async list(householdId: string): Promise<CategoryRow[]> {
    const rows = await getDb().categories.where("householdId").equals(householdId).toArray();
    return rows.filter((c) => c.archivedAt === null).sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async get(id: string): Promise<CategoryRow | undefined> {
    return getDb().categories.get(id);
  },

  async create(input: NewCategoryInput): Promise<CategoryRow> {
    const row: CategoryRow = { ...input, id: newId(), archivedAt: null };
    await getDb().categories.add(row);
    return row;
  },

  async update(id: string, patch: Partial<CategoryRow>): Promise<void> {
    await getDb().categories.update(id, patch);
  },

  async archive(id: string): Promise<void> {
    await getDb().categories.update(id, { archivedAt: new Date().toISOString() });
  },

  async bulkCreate(inputs: NewCategoryInput[]): Promise<CategoryRow[]> {
    const rows = inputs.map((input) => ({ ...input, id: newId(), archivedAt: null }));
    await getDb().categories.bulkAdd(rows);
    return rows;
  },
};
