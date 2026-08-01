import { getDb } from "../db/client";
import type { TagRow } from "../db/schema";
import { outbox } from "../offline/outbox";
import { newId } from "./ids";

export const tagsRepo = {
  async list(householdId: string): Promise<TagRow[]> {
    return getDb().tags.where("householdId").equals(householdId).toArray();
  },

  async create(householdId: string, name: string, color: string | null = null): Promise<TagRow> {
    const db = getDb();
    const row: TagRow = { id: newId(), householdId, name, color };
    // C4 — enqueue en la misma transacción que la escritura (ver nota en accounts-repo.ts).
    await db.transaction("rw", db.tags, db.outbox, async () => {
      await db.tags.add(row);
      await outbox.enqueue({ table: "tags", op: "insert", entityId: row.id, payload: row, clientRev: 1 });
    });
    return row;
  },

  async rename(id: string, name: string): Promise<void> {
    const db = getDb();
    await db.transaction("rw", db.tags, db.outbox, async () => {
      await db.tags.update(id, { name });
      const row = await db.tags.get(id);
      if (row) await outbox.enqueue({ table: "tags", op: "update", entityId: id, payload: row, clientRev: 1 });
    });
  },

  async remove(id: string): Promise<void> {
    const db = getDb();
    await db.transaction("rw", db.tags, db.outbox, async () => {
      await db.tags.delete(id);
      // tags no tiene deleted_at (no lleva significado financiero): el
      // worker traduce este "delete" a un DELETE real contra Supabase.
      await outbox.enqueue({ table: "tags", op: "delete", entityId: id, payload: {}, clientRev: 1 });
    });
  },
};
