import { getDb } from "../db/client";
import type { CategoryRow } from "../db/schema";
import { outbox } from "../offline/outbox";
import { newId, nowIso } from "./ids";

export type NewCategoryInput = Omit<
  CategoryRow,
  "id" | "archivedAt" | "createdAt" | "updatedAt" | "deletedAt" | "clientRev"
>;

export const categoriesRepo = {
  async list(householdId: string): Promise<CategoryRow[]> {
    const rows = await getDb().categories.where("householdId").equals(householdId).toArray();
    // `deletedAt` se empezó a filtrar cuando apareció `remove()`: antes nada
    // escribía esa columna para categorías, así que la condición no existía
    // y una categoría borrada habría seguido apareciendo acá.
    return rows.filter((c) => c.archivedAt === null && c.deletedAt === null).sort((a, b) => a.sortOrder - b.sortOrder);
  },

  /**
   * Solo las archivadas. Existe como consulta aparte —y no relajando el
   * filtro de `list()`— porque de `list()` cuelga toda la app: la captura,
   * los filtros de movimientos, los presupuestos y los análisis asumen que
   * lo que reciben es lo que se puede elegir HOY. Meterles las archivadas
   * ahí las haría reaparecer como opción en todos lados.
   *
   * El único consumidor es la sección "Archivadas" de `/more/categories`,
   * que es lo que hace que archivar sea reversible: antes `restoreMany` solo
   * estaba cableado al "Deshacer" del toast, así que una vez que ese toast
   * se iba no había ninguna pantalla desde donde recuperarla.
   */
  async listArchived(householdId: string): Promise<CategoryRow[]> {
    const rows = await getDb().categories.where("householdId").equals(householdId).toArray();
    return rows.filter((c) => c.archivedAt !== null && c.deletedAt === null).sort((a, b) => a.sortOrder - b.sortOrder);
  },

  /**
   * TODAS las filas del household, sin filtrar archivadas ni borradas. NO es
   * una fuente de opciones para un picker —para eso está `list()`— existe
   * solo para resolver el NOMBRE de una categoría histórica. Un movimiento
   * conserva su `categoryId` para siempre, así que archivar o borrar una
   * categoría no puede convertir su etiqueta en el UUID crudo (ver
   * `useCategoryDirectory`, que es el único consumidor pensado para esto).
   */
  async listForLabels(householdId: string): Promise<CategoryRow[]> {
    return getDb().categories.where("householdId").equals(householdId).toArray();
  },

  /**
   * Borrado de verdad, a diferencia de `archive()`: la categoría desaparece
   * de las dos listas y no vuelve.
   *
   * Es un soft delete (`deletedAt`) y no un `db.categories.delete()` porque
   * la fila tiene que viajar por el outbox para que el borrado llegue al
   * servidor y a los otros dispositivos — mismo patrón que
   * `transactionsRepo.softDelete`. Que sea recuperable desde la base no lo
   * hace recuperable desde la interfaz: para el usuario esto es definitivo,
   * y por eso la pantalla solo lo ofrece cuando NADA referencia a la
   * categoría (ver `buildCategoryUsageIndex`). Este método no revalida esa
   * condición: quien llama es responsable de haberla chequeado.
   */
  async remove(id: string): Promise<void> {
    await enqueueCategoryUpdate(id, { deletedAt: nowIso() });
  },

  /**
   * Borra un subárbol completo. `ids` viene de `collectSubtree`, en orden de
   * hoja a raíz: así no hay ningún instante intermedio con hijas colgando de
   * una madre que ya no está.
   *
   * Simétrico a `archiveWithChildren`: archivar arrastra a las hijas, así que
   * borrar también. Quien llama es responsable de haber verificado que NADA
   * del subárbol esté referenciado (`subtreeUsage` + `isDeletable`).
   */
  async removeMany(ids: string[]): Promise<void> {
    for (const id of ids) {
      await enqueueCategoryUpdate(id, { deletedAt: nowIso() });
    }
  },

  async get(id: string): Promise<CategoryRow | undefined> {
    return getDb().categories.get(id);
  },

  async create(input: NewCategoryInput): Promise<CategoryRow> {
    const db = getDb();
    const now = nowIso();
    const row: CategoryRow = { ...input, id: newId(), archivedAt: null, createdAt: now, updatedAt: now, deletedAt: null, clientRev: 1 };
    // C4 — enqueue en la misma transacción que la escritura (ver nota en accounts-repo.ts).
    await db.transaction("rw", db.categories, db.outbox, async () => {
      await db.categories.add(row);
      await outbox.enqueue({ table: "categories", op: "insert", entityId: row.id, payload: row, clientRev: row.clientRev });
    });
    return row;
  },

  async update(id: string, patch: Partial<CategoryRow>): Promise<void> {
    await enqueueCategoryUpdate(id, patch);
  },

  async archive(id: string): Promise<void> {
    await enqueueCategoryUpdate(id, { archivedAt: nowIso() });
  },

  /**
   * Archiva la categoría y, si es raíz, todas sus hijas en cascada — una
   * hija con `parentId` apuntando a un padre archivado desaparece de
   * `CategoryStep` (que arma `roots` con `parentId === null`) pero sigue
   * siendo asignable desde reglas y presupuestos: un fantasma. Devuelve los
   * ids afectados para que el toast de Deshacer pueda revivirlos todos.
   */
  async archiveWithChildren(id: string): Promise<string[]> {
    const db = getDb();
    const all = await db.categories.toArray();
    const children = all.filter((c) => c.parentId === id && c.archivedAt === null);
    const ids = [id, ...children.map((c) => c.id)];
    const archivedAt = nowIso();
    await db.transaction("rw", db.categories, db.outbox, async () => {
      for (const categoryId of ids) {
        await enqueueCategoryUpdateInTransaction(db, categoryId, { archivedAt });
      }
    });
    return ids;
  },

  /** Deshacer de `archiveWithChildren`: revive el subárbol completo. */
  async restoreMany(ids: string[]): Promise<void> {
    const db = getDb();
    await db.transaction("rw", db.categories, db.outbox, async () => {
      for (const id of ids) {
        await enqueueCategoryUpdateInTransaction(db, id, { archivedAt: null });
      }
    });
  },

  async bulkCreate(inputs: NewCategoryInput[]): Promise<CategoryRow[]> {
    const db = getDb();
    const now = nowIso();
    const rows = inputs.map((input) => ({ ...input, id: newId(), archivedAt: null, createdAt: now, updatedAt: now, deletedAt: null, clientRev: 1 }));
    await db.transaction("rw", db.categories, db.outbox, async () => {
      await db.categories.bulkAdd(rows);
      for (const row of rows) {
        await outbox.enqueue({ table: "categories", op: "insert", entityId: row.id, payload: row, clientRev: row.clientRev });
      }
    });
    return rows;
  },
};

/**
 * Copy-on-write: editar nombre o ícono de una categoría de plantilla la
 * vuelve propia del usuario — `isSystem: false`, para que deje de
 * traducirse (`useCategoryLabel` exige `isSystem` además de `i18nKey`) y
 * para que `applyCategoryTemplate` deje de archivarla o revivirla por
 * elección de plantilla. Archivar/revivir (`{ archivedAt }`) no pasa por
 * acá con nombre/ícono, así que no desprende nada.
 *
 * `i18nKey` se deja INTACTO a propósito — no se anula. Es la identidad
 * estable que le permite a `applyCategoryTemplate` reconocer "esta clave de
 * plantilla ya está resuelta, no crear una fila nueva" aunque la fila haya
 * cambiado de nombre. Anularlo fue la causa real de las categorías
 * duplicadas: renombrar "Salud" → "Médicos" y después cambiar de plantilla
 * dejaba de encontrar la fila por `i18nKey` y creaba una "Salud" nueva.
 */
export function detachFromTemplate(existing: CategoryRow, patch: Partial<CategoryRow>): Partial<CategoryRow> {
  if (!existing.isSystem) return patch;
  if (patch.name === undefined && patch.icon === undefined) return patch;
  return { ...patch, isSystem: false };
}

/** C10 — clientRev real: se lee, se incrementa, y el mismo valor se persiste y se manda al outbox. */
async function enqueueCategoryUpdate(id: string, patch: Partial<CategoryRow>): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.categories, db.outbox, async () => {
    await enqueueCategoryUpdateInTransaction(db, id, patch);
  });
}

/** Misma lógica que `enqueueCategoryUpdate`, para componer varias filas en una sola transacción `rw`. */
async function enqueueCategoryUpdateInTransaction(db: ReturnType<typeof getDb>, id: string, patch: Partial<CategoryRow>): Promise<void> {
  const existing = await db.categories.get(id);
  if (!existing) return;
  const nextRev = existing.clientRev + 1;
  const updated: CategoryRow = { ...existing, ...detachFromTemplate(existing, patch), updatedAt: nowIso(), clientRev: nextRev };
  await db.categories.put(updated);
  await outbox.enqueue({ table: "categories", op: "update", entityId: id, payload: updated, clientRev: nextRev });
}
