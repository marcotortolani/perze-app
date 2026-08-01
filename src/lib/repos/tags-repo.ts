import { getDb } from "../db/client";
import type { TagRow } from "../db/schema";
import { outbox } from "../offline/outbox";
import { newId } from "./ids";

export const tagsRepo = {
  async list(householdId: string): Promise<TagRow[]> {
    return getDb().tags.where("householdId").equals(householdId).toArray();
  },

  async create(householdId: string, name: string, color: string | null = null): Promise<TagRow> {
    const row: TagRow = { id: newId(), householdId, name, color, clientRev: 1 };
    await getDb().tags.add(row);
    await outbox.enqueue({ table: "tags", op: "insert", entityId: row.id, payload: row, clientRev: row.clientRev });
    return row;
  },

  async rename(id: string, name: string): Promise<void> {
    const db = getDb();
    await db.transaction("rw", db.tags, db.outbox, async () => {
      const existing = await db.tags.get(id);
      if (!existing) return;
      const nextRev = existing.clientRev + 1;
      const updated: TagRow = { ...existing, name, clientRev: nextRev };
      await db.tags.put(updated);
      await outbox.enqueue({ table: "tags", op: "update", entityId: id, payload: updated, clientRev: nextRev });
    });
  },

  async remove(id: string): Promise<void> {
    const db = getDb();
    await db.transaction("rw", db.tags, db.outbox, async () => {
      const existing = await db.tags.get(id);
      await db.tags.delete(id);
      // tags no tiene deleted_at (no lleva significado financiero): el
      // worker traduce este "delete" a un DELETE real contra Supabase.
      await outbox.enqueue({ table: "tags", op: "delete", entityId: id, payload: {}, clientRev: (existing?.clientRev ?? 0) + 1 });
    });
  },
};
