import { getDb } from "../db/client";
import type { PayeeRow } from "../db/schema";
import { outbox } from "../offline/outbox";
import { newId } from "./ids";

export type NewPayeeInput = Omit<PayeeRow, "id">;

export const payeesRepo = {
  async list(householdId: string): Promise<PayeeRow[]> {
    return getDb().payees.where("householdId").equals(householdId).toArray();
  },

  /** Autocompletado — el comercio recuerda su categoría por defecto. */
  async findByName(householdId: string, name: string): Promise<PayeeRow | undefined> {
    const payees = await getDb().payees.where("householdId").equals(householdId).toArray();
    const needle = name.trim().toLowerCase();
    return payees.find(
      (p) => p.name.toLowerCase() === needle || p.aliases.some((a) => a.toLowerCase() === needle)
    );
  },

  async create(input: NewPayeeInput): Promise<PayeeRow> {
    const row: PayeeRow = { ...input, id: newId() };
    await getDb().payees.add(row);
    await outbox.enqueue({ table: "payees", op: "insert", entityId: row.id, payload: row, clientRev: 1 });
    return row;
  },

  async update(id: string, patch: Partial<PayeeRow>): Promise<void> {
    await getDb().payees.update(id, patch);
    const row = await getDb().payees.get(id);
    if (row) await outbox.enqueue({ table: "payees", op: "update", entityId: id, payload: row, clientRev: 1 });
  },

  async remove(id: string): Promise<void> {
    await getDb().payees.delete(id);
    // payees no tiene deleted_at (igual que tags): el worker traduce este
    // "delete" a un DELETE real contra Supabase.
    await outbox.enqueue({ table: "payees", op: "delete", entityId: id, payload: {}, clientRev: 1 });
  },
};
