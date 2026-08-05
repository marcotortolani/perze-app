import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "../db/client";
import { buildCategoryUsageIndex, collectSubtree, isDeletable, subtreeUsage, totalUsage } from "./category-usage";
import type { CategoryRow } from "../db/schema";

const HOUSEHOLD = "hh-1";
const USER = "user-1";

function category(overrides: Partial<CategoryRow> = {}): CategoryRow {
  return {
    id: "c-1",
    householdId: HOUSEHOLD,
    parentId: null,
    name: "Supermercado",
    i18nKey: null,
    icon: "cart",
    color: "var(--data-1)",
    kind: "expense",
    nature: "variable",
    isSystem: false,
    sortOrder: 0,
    archivedAt: null,
    visibility: "household",
    ownerId: null,
    createdBy: USER,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    clientRev: 1,
    ...overrides,
  };
}

/**
 * El criterio que pidió el usuario era "0 movimientos", pero una categoría
 * puede tener 0 transacciones y estar referenciada igual desde otras cinco
 * tablas. La más grave es `transaction_splits.categoryId`, que NO admite
 * null: un reparto cuya categoría se borró no se puede renderizar ni
 * reparar desde la interfaz.
 */
describe("buildCategoryUsageIndex", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-category-usage-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("una categoría sin ninguna referencia se puede borrar", async () => {
    const cat = category();
    await getDb().categories.put(cat);

    const index = await buildCategoryUsageIndex(HOUSEHOLD);

    expect(totalUsage(index.usageOf(cat.id))).toBe(0);
    expect(isDeletable(index.usageOf(cat.id))).toBe(true);
  });

  it("un reparto la bloquea aunque no tenga ninguna transacción propia", async () => {
    const cat = category();
    await getDb().categories.put(cat);
    await getDb().transactionSplits.put({ id: "s-1", transactionId: "tx-9", categoryId: cat.id, amount: 100n, note: null } as never);

    const usage = (await buildCategoryUsageIndex(HOUSEHOLD)).usageOf(cat.id);

    expect(usage.transactions).toBe(0);
    expect(usage.splits).toBe(1);
    expect(isDeletable(usage)).toBe(false);
  });

  it("tener subcategorías NO bloquea: se borran en cascada con la madre", async () => {
    const parent = category();
    const child = category({ id: "c-2", parentId: parent.id, name: "Almacén" });
    await getDb().categories.bulkPut([parent, child]);

    const index = await buildCategoryUsageIndex(HOUSEHOLD);

    // El conteo sigue existiendo (sirve para avisar cuántas se van), pero no
    // es lo que decide.
    expect(index.usageOf(parent.id).children).toBe(1);
    expect(isDeletable(subtreeUsage(index, parent.id))).toBe(true);
    expect(collectSubtree(index, parent.id)).toEqual([child.id, parent.id]);
  });

  it("lo que una HIJA tenga asociado sí bloquea a la madre", async () => {
    const parent = category();
    const child = category({ id: "c-2", parentId: parent.id, name: "Almacén" });
    await getDb().categories.bulkPut([parent, child]);
    await getDb().transactionSplits.put({ id: "s-1", transactionId: "tx-1", categoryId: child.id, amount: 100n, note: null } as never);

    const index = await buildCategoryUsageIndex(HOUSEHOLD);

    // La madre no tiene NINGUNA referencia propia...
    expect(index.usageOf(parent.id).splits).toBe(0);
    expect(index.usageOf(parent.id).transactions).toBe(0);
    // ...pero borrarla arrastraría a la hija, que sí tiene un reparto
    // apuntándole. El bloqueo lo decide el subárbol, no la fila.
    expect(subtreeUsage(index, parent.id).splits).toBe(1);
    expect(isDeletable(subtreeUsage(index, parent.id))).toBe(false);
  });

  it("el subárbol se devuelve de hoja a raíz, para no dejar hijas colgando a mitad del borrado", async () => {
    const parent = category();
    const a = category({ id: "c-2", parentId: parent.id, name: "A" });
    const b = category({ id: "c-3", parentId: parent.id, name: "B" });
    await getDb().categories.bulkPut([parent, a, b]);

    const orden = collectSubtree(await buildCategoryUsageIndex(HOUSEHOLD), parent.id);

    expect(orden[orden.length - 1]).toBe(parent.id);
    expect(orden.slice(0, -1).sort()).toEqual([a.id, b.id].sort());
  });

  it("cuenta cada tipo de referencia por separado, sin mezclarlos", async () => {
    const cat = category();
    await getDb().categories.put(cat);
    await getDb().transactionSplits.bulkPut([
      { id: "s-1", transactionId: "tx-1", categoryId: cat.id, amount: 100n, note: null },
      { id: "s-2", transactionId: "tx-2", categoryId: cat.id, amount: 200n, note: null },
    ] as never[]);

    const usage = (await buildCategoryUsageIndex(HOUSEHOLD)).usageOf(cat.id);

    expect(usage.splits).toBe(2);
    expect(usage.budgets).toBe(0);
    expect(usage.payees).toBe(0);
    expect(totalUsage(usage)).toBe(2);
  });

  it("una categoría desconocida no rompe: devuelve todo en cero", async () => {
    const index = await buildCategoryUsageIndex(HOUSEHOLD);
    expect(isDeletable(index.usageOf("no-existe"))).toBe(true);
  });

  it("una hija ARCHIVADA sigue bloqueando a su madre", async () => {
    const parent = category();
    const child = category({ id: "c-2", parentId: parent.id, name: "Almacén", archivedAt: "2026-02-01T00:00:00.000Z" });
    await getDb().categories.bulkPut([parent, child]);

    const index = await buildCategoryUsageIndex(HOUSEHOLD);

    // Archivar no la hace desaparecer: borrar a la madre la dejaría igual de
    // huérfana.
    expect(index.usageOf(parent.id).children).toBe(1);
  });

  /**
   * Regresión del bug reportado: borrabas una categoría archivada y la
   * siguiente quedaba bloqueada por subcategorías que ya no existían, hasta
   * recargar la página. La causa era que la lista de categorías llegaba por
   * parámetro desde el estado de React —posiblemente vieja— mientras las
   * otras seis tablas se leían frescas de Dexie. Ahora las siete se leen
   * acá, así que el índice no puede quedar desfasado de la base.
   */
  it("una hija BORRADA deja de contar sin necesidad de recargar", async () => {
    const parent = category();
    const child = category({ id: "c-2", parentId: parent.id, name: "Almacén" });
    await getDb().categories.bulkPut([parent, child]);
    expect((await buildCategoryUsageIndex(HOUSEHOLD)).usageOf(parent.id).children).toBe(1);

    await getDb().categories.put({ ...child, deletedAt: "2026-02-01T00:00:00.000Z" });

    const index = await buildCategoryUsageIndex(HOUSEHOLD);
    expect(index.usageOf(parent.id).children).toBe(0);
    expect(isDeletable(subtreeUsage(index, parent.id))).toBe(true);
  });
});
