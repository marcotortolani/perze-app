import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "../db/client";
import { outbox } from "../offline/outbox";
import { categoriesRepo, detachFromTemplate } from "./categories-repo";
import type { CategoryRow } from "../db/schema";

const HOUSEHOLD = "hh-1";
const USER = "user-1";

function category(overrides: Partial<CategoryRow> = {}): CategoryRow {
  return {
    id: "c-1",
    householdId: HOUSEHOLD,
    parentId: null,
    name: "Supermercado",
    i18nKey: "groceries",
    icon: "cart",
    color: "var(--data-1)",
    kind: "expense",
    nature: "variable",
    isSystem: true,
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

describe("detachFromTemplate — copy-on-write", () => {
  it("editar name sobre isSystem:true desprende (isSystem false) pero conserva i18nKey", () => {
    const existing = category();
    const patch = detachFromTemplate(existing, { name: "Almacén" });
    // `i18nKey` NO se anula — es la identidad que evita que un cambio de
    // plantilla posterior recree "Supermercado" para la misma clave.
    expect(patch).toEqual({ name: "Almacén", isSystem: false });
  });

  it("editar icon sobre isSystem:true desprende igual, conservando i18nKey", () => {
    const existing = category();
    const patch = detachFromTemplate(existing, { icon: "storefront" });
    expect(patch).toEqual({ icon: "storefront", isSystem: false });
  });

  it("archivar (solo archivedAt) sobre isSystem:true NO desprende", () => {
    const existing = category();
    const patch = detachFromTemplate(existing, { archivedAt: "2026-02-01T00:00:00.000Z" });
    expect(patch).toEqual({ archivedAt: "2026-02-01T00:00:00.000Z" });
  });

  it("sobre isSystem:false, el patch pasa intacto", () => {
    const existing = category({ isSystem: false, i18nKey: null });
    const patch = detachFromTemplate(existing, { name: "Otro nombre" });
    expect(patch).toEqual({ name: "Otro nombre" });
  });
});

describe("categoriesRepo", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-categories-repo-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("update con name sobre una categoría de plantilla la desprende y sube clientRev", async () => {
    const [created] = await categoriesRepo.bulkCreate([
      { householdId: HOUSEHOLD, parentId: null, name: "Supermercado", i18nKey: "groceries", icon: "cart", color: "var(--data-1)", kind: "expense", nature: "variable", isSystem: true, sortOrder: 0, visibility: "household", ownerId: null, createdBy: USER },
    ]);
    await categoriesRepo.update(created!.id, { name: "Almacén" });

    const updated = await categoriesRepo.get(created!.id);
    expect(updated?.name).toBe("Almacén");
    expect(updated?.isSystem).toBe(false);
    expect(updated?.i18nKey).toBe("groceries");
    expect(updated?.clientRev).toBe(2);
  });

  it("update con archivedAt sobre una categoría de plantilla NO la desprende", async () => {
    const [created] = await categoriesRepo.bulkCreate([
      { householdId: HOUSEHOLD, parentId: null, name: "Supermercado", i18nKey: "groceries", icon: "cart", color: "var(--data-1)", kind: "expense", nature: "variable", isSystem: true, sortOrder: 0, visibility: "household", ownerId: null, createdBy: USER },
    ]);
    await categoriesRepo.archive(created!.id);

    const updated = await categoriesRepo.get(created!.id);
    expect(updated?.isSystem).toBe(true);
    expect(updated?.i18nKey).toBe("groceries");
    expect(updated?.archivedAt).not.toBeNull();
  });

  describe("archiveWithChildren / restoreMany", () => {
    async function seedParentWithChildren() {
      const [parent] = await categoriesRepo.bulkCreate([
        { householdId: HOUSEHOLD, parentId: null, name: "Salud", i18nKey: null, icon: "heart-pulse", color: "var(--data-3)", kind: "expense", nature: "variable", isSystem: false, sortOrder: 0, visibility: "household", ownerId: null, createdBy: USER },
      ]);
      const children = await categoriesRepo.bulkCreate([
        { householdId: HOUSEHOLD, parentId: parent!.id, name: "Farmacia", i18nKey: null, icon: "pharmacy", color: "var(--data-3)", kind: "expense", nature: "variable", isSystem: false, sortOrder: 1, visibility: "household", ownerId: null, createdBy: USER },
        { householdId: HOUSEHOLD, parentId: parent!.id, name: "Consultas", i18nKey: null, icon: "stethoscope", color: "var(--data-3)", kind: "expense", nature: "variable", isSystem: false, sortOrder: 2, visibility: "household", ownerId: null, createdBy: USER },
        { householdId: HOUSEHOLD, parentId: parent!.id, name: "Seguro", i18nKey: null, icon: "shield", color: "var(--data-3)", kind: "expense", nature: "variable", isSystem: false, sortOrder: 3, visibility: "household", ownerId: null, createdBy: USER },
      ]);
      return { parent: parent!, children };
    }

    it("archiva la raíz y sus hijas, devuelve los 4 ids", async () => {
      const { parent, children } = await seedParentWithChildren();

      const ids = await categoriesRepo.archiveWithChildren(parent.id);

      expect(ids).toHaveLength(4);
      expect(new Set(ids)).toEqual(new Set([parent.id, ...children.map((c) => c.id)]));
      const remaining = await categoriesRepo.list(HOUSEHOLD);
      expect(remaining).toHaveLength(0);
    });

    it("encola un update en el outbox por cada fila archivada", async () => {
      const { parent } = await seedParentWithChildren();
      await categoriesRepo.archiveWithChildren(parent.id);

      const pending = (await outbox.listPending()).filter((e) => e.table === "categories" && e.op === "update");
      expect(pending.length).toBeGreaterThanOrEqual(4);
    });

    it("archivar una hoja (sin hijas) devuelve un solo id", async () => {
      const { children } = await seedParentWithChildren();
      const leaf = children[0]!;

      const ids = await categoriesRepo.archiveWithChildren(leaf.id);

      expect(ids).toEqual([leaf.id]);
    });

    it("restoreMany revive todo el subárbol", async () => {
      const { parent, children } = await seedParentWithChildren();
      const ids = await categoriesRepo.archiveWithChildren(parent.id);

      await categoriesRepo.restoreMany(ids);

      const restored = await categoriesRepo.list(HOUSEHOLD);
      expect(restored).toHaveLength(1 + children.length);
      expect(restored.every((c) => c.archivedAt === null)).toBe(true);
    });

    // Sin esta consulta, archivar era irreversible en la práctica: `list()`
    // filtra las archivadas y `restoreMany` solo estaba cableado al
    // "Deshacer" del toast, así que apenas ese toast se iba no había ninguna
    // pantalla desde donde recuperarlas.
    it("listArchived devuelve exactamente lo que list() esconde", async () => {
      const { parent, children } = await seedParentWithChildren();
      const leaf = children[0]!;

      await categoriesRepo.archiveWithChildren(leaf.id);

      const activas = await categoriesRepo.list(HOUSEHOLD);
      const archivadas = await categoriesRepo.listArchived(HOUSEHOLD);

      expect(archivadas.map((c) => c.id)).toEqual([leaf.id]);
      expect(archivadas.every((c) => c.archivedAt !== null)).toBe(true);
      expect(activas.map((c) => c.id).sort()).toEqual([parent.id, children[1]!.id, children[2]!.id].sort());
      // Las dos listas particionan el total: ninguna fila se pierde ni se repite.
      expect(activas.length + archivadas.length).toBe(1 + children.length);
    });

    it("listArchived queda vacío cuando no hay ninguna archivada", async () => {
      await seedParentWithChildren();
      expect(await categoriesRepo.listArchived(HOUSEHOLD)).toEqual([]);
    });

    // `listForLabels` es la única consulta que NO filtra: existe para
    // resolver nombres de categorías históricas (un movimiento conserva su
    // `categoryId` aunque la categoría se archive o se borre), nunca para
    // poblar un picker. Si esto vuelve a filtrar, el radar de gasto por
    // categoría vuelve a mostrar UUIDs.
    it("listForLabels devuelve activas, archivadas Y borradas — a diferencia de list()", async () => {
      const { parent, children } = await seedParentWithChildren();
      const archivedLeaf = children[0]!;
      const removedLeaf = children[1]!;

      await categoriesRepo.archiveWithChildren(archivedLeaf.id);
      await categoriesRepo.remove(removedLeaf.id);

      const forLabels = await categoriesRepo.listForLabels(HOUSEHOLD);
      const activeOnly = await categoriesRepo.list(HOUSEHOLD);

      expect(forLabels.map((c) => c.id).sort()).toEqual([parent.id, archivedLeaf.id, removedLeaf.id, children[2]!.id].sort());
      expect(activeOnly.map((c) => c.id).sort()).toEqual([parent.id, children[2]!.id].sort());
    });
  });
});
