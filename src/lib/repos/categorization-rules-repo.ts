import { getDb } from "../db/client";
import type { CategorizationRuleRow } from "../db/schema";
import { outbox } from "../offline/outbox";
import { newId, nowIso } from "./ids";

export type NewCategorizationRuleInput = Omit<CategorizationRuleRow, "id" | "hitCount" | "deletedAt" | "createdAt" | "updatedAt" | "clientRev">;

export const categorizationRulesRepo = {
  async list(householdId: string): Promise<CategorizationRuleRow[]> {
    const rows = await getDb().categorizationRules.where("householdId").equals(householdId).toArray();
    return rows.filter((r) => r.deletedAt === null).sort((a, b) => b.priority - a.priority);
  },

  async create(input: NewCategorizationRuleInput): Promise<CategorizationRuleRow> {
    const db = getDb();
    const now = nowIso();
    const row: CategorizationRuleRow = { ...input, id: newId(), hitCount: 0, deletedAt: null, createdAt: now, updatedAt: now, clientRev: 1 };
    // C4 — enqueue en la misma transacción que la escritura (ver nota en accounts-repo.ts).
    await db.transaction("rw", db.categorizationRules, db.outbox, async () => {
      await db.categorizationRules.add(row);
      await outbox.enqueue({ table: "rules", op: "insert", entityId: row.id, payload: row, clientRev: row.clientRev });
    });
    return row;
  },

  async update(id: string, patch: Partial<CategorizationRuleRow>): Promise<void> {
    const db = getDb();
    // C10 — clientRev real, ver la nota en accounts-repo.ts.
    await db.transaction("rw", db.categorizationRules, db.outbox, async () => {
      const existing = await db.categorizationRules.get(id);
      // Lanza en vez de resolver en silencio: todos los call sites pasan el
      // id de una fila que acaban de leer, así que no encontrarla es un
      // error. Mismo criterio que `accounts-repo.ts`, donde un `return`
      // silencioso hacía que archivar una cuenta mostrara el toast de éxito
      // sin escribir nada.
      if (!existing) throw new Error(`Regla ${id} no encontrada`);
      const nextRev = existing.clientRev + 1;
      const updated: CategorizationRuleRow = { ...existing, ...patch, updatedAt: nowIso(), clientRev: nextRev };
      await db.categorizationRules.put(updated);
      await outbox.enqueue({ table: "rules", op: "update", entityId: id, payload: updated, clientRev: nextRev });
    });
  },

  /**
   * Borra la regla. Se llamaba `archive()`, pero no archivaba: pone
   * `deletedAt` y `list()` filtra por esa columna, así que la regla
   * desaparece y no hay ninguna pantalla que muestre las "archivadas". El
   * nombre viejo describía algo que no existe; no tenía ningún caller, así
   * que renombrarlo no rompe nada.
   *
   * Soft delete y no un `delete()` de Dexie para que el borrado viaje por el
   * outbox hasta el servidor — mismo patrón que `categoriesRepo.remove`.
   */
  async remove(id: string): Promise<void> {
    await this.update(id, { deletedAt: nowIso() });
  },

  /** Deshacer de `remove()` — lo usa el toast de la lista de reglas. */
  async restore(id: string): Promise<void> {
    await this.update(id, { deletedAt: null });
  },

  /** Se llama cuando una regla efectivamente categorizó un movimiento — para el badge "9 correcciones sobre 28" de K7. */
  async recordHit(id: string): Promise<void> {
    const row = await getDb().categorizationRules.get(id);
    if (!row) return;
    await this.update(id, { hitCount: row.hitCount + 1 });
  },
};
