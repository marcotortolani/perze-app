import { getDb } from "../db/client";
import type { TagRow } from "../db/schema";
import { newId } from "./ids";

export const tagsRepo = {
  async list(householdId: string): Promise<TagRow[]> {
    return getDb().tags.where("householdId").equals(householdId).toArray();
  },

  async create(householdId: string, name: string, color: string | null = null): Promise<TagRow> {
    const row: TagRow = { id: newId(), householdId, name, color };
    await getDb().tags.add(row);
    return row;
  },

  async remove(id: string): Promise<void> {
    await getDb().tags.delete(id);
  },
};
