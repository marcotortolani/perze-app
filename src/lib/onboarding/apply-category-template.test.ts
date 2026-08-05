import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "../db/client";
import { categoriesRepo } from "../repos/categories-repo";
import { applyCategoryTemplate } from "./apply-category-template";

describe("applyCategoryTemplate — reconciliación por i18nKey (no duplica)", () => {
  const householdId = "household-1";
  const userId = "user-1";

  beforeEach(() => {
    resetDbForTests(`perze-test-apply-category-template-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("aplicar la misma plantilla dos veces no crea duplicados", async () => {
    await applyCategoryTemplate(householdId, "basic", userId, new Set());
    await applyCategoryTemplate(householdId, "basic", userId, new Set());

    const categories = await categoriesRepo.list(householdId);
    const groceries = categories.filter((c) => c.i18nKey === "groceries");
    const otherIncome = categories.filter((c) => c.i18nKey === "otherIncome");
    expect(groceries).toHaveLength(1);
    expect(otherIncome).toHaveLength(1);
  });

  it("reaplicar con una categoría ya usada no la duplica (el bug reportado)", async () => {
    await applyCategoryTemplate(householdId, "basic", userId, new Set());
    const first = await categoriesRepo.list(householdId);
    const groceries = first.find((c) => c.i18nKey === "groceries")!;

    // Simula que "Supermercado" ya tiene movimientos cargados.
    await applyCategoryTemplate(householdId, "basic", userId, new Set([groceries.id]));

    const after = await categoriesRepo.list(householdId);
    expect(after.filter((c) => c.i18nKey === "groceries")).toHaveLength(1);
    // Es la MISMA fila, no una nueva con otro id.
    expect(after.find((c) => c.i18nKey === "groceries")!.id).toBe(groceries.id);
  });

  it("una categoría archivada que reaparece en la plantilla nueva se revive, no se duplica", async () => {
    await applyCategoryTemplate(householdId, "basic", userId, new Set());
    const first = await categoriesRepo.list(householdId);
    const groceries = first.find((c) => c.i18nKey === "groceries")!;
    await categoriesRepo.archive(groceries.id);

    await applyCategoryTemplate(householdId, "basic", userId, new Set());

    const after = await categoriesRepo.list(householdId);
    const revived = after.filter((c) => c.i18nKey === "groceries");
    expect(revived).toHaveLength(1);
    expect(revived[0]!.id).toBe(groceries.id);
  });

  it("una categoría sin uso y fuera de la plantilla nueva se archiva, no se duplica en la siguiente pasada", async () => {
    await applyCategoryTemplate(householdId, "complete", userId, new Set());
    await applyCategoryTemplate(householdId, "basic", userId, new Set());

    const categories = await categoriesRepo.list(householdId);
    // "groceriesPantry" (hija de "complete") no está en "basic" y nadie la usó.
    expect(categories.find((c) => c.i18nKey === "groceriesPantry")).toBeUndefined();

    // Volver a "complete" no debería duplicar lo que ya sobrevivió de "basic".
    await applyCategoryTemplate(householdId, "complete", userId, new Set());
    const final = await categoriesRepo.list(householdId);
    expect(final.filter((c) => c.i18nKey === "groceries")).toHaveLength(1);
  });

  it("una categoría desprendida (editada por el usuario) sobrevive a 'empezar de cero', con su i18nKey intacto", async () => {
    await applyCategoryTemplate(householdId, "basic", userId, new Set());
    const first = await categoriesRepo.list(householdId);
    const groceries = first.find((c) => c.i18nKey === "groceries")!;
    // Copy-on-write: editar el nombre la desprende de la plantilla.
    await categoriesRepo.update(groceries.id, { name: "Almacén" });

    await applyCategoryTemplate(householdId, "scratch", userId, new Set());

    const after = await categoriesRepo.list(householdId);
    const detached = after.find((c) => c.id === groceries.id);
    expect(detached).toBeDefined();
    expect(detached?.archivedAt).toBeNull();
    expect(detached?.name).toBe("Almacén");
    expect(detached?.isSystem).toBe(false);
    // `i18nKey` se conserva a propósito — es lo que evita que un cambio de
    // plantilla posterior cree una "Supermercado" nueva para la misma clave.
    expect(detached?.i18nKey).toBe("groceries");
  });

  it("renombrar 'Salud' (copy-on-write) y reaplicar 'completa': NO crea una 'Salud' duplicada, las hijas siguen bajo 'Médicos'", async () => {
    await applyCategoryTemplate(householdId, "complete", userId, new Set());
    const first = await categoriesRepo.list(householdId);
    const health = first.find((c) => c.i18nKey === "health")!;
    const childrenBefore = first.filter((c) => c.parentId === health.id);
    expect(childrenBefore).toHaveLength(3);

    // El usuario renombra "Salud" → "Médicos": queda desprendida (isSystem
    // false), pero conserva `i18nKey: "health"` — sus hijas de plantilla
    // (todavía `isSystem`) no se tocan.
    await categoriesRepo.update(health.id, { name: "Médicos" });
    expect((await categoriesRepo.get(health.id))?.i18nKey).toBe("health");

    // Cambiar de plantilla (ida y vuelta) ya no crea una "Salud" nueva: la
    // reconciliación por `i18nKey` encuentra "Médicos" —conserva la clave— y
    // no le toca el `archivedAt` (es del usuario, no de la plantilla).
    await applyCategoryTemplate(householdId, "basic", userId, new Set());
    await applyCategoryTemplate(householdId, "complete", userId, new Set());

    const after = await categoriesRepo.list(householdId);
    expect(after.filter((c) => c.i18nKey === "health")).toHaveLength(1);
    expect(after.find((c) => c.i18nKey === "health")!.id).toBe(health.id);

    const childrenAfter = after.filter((c) => c.parentId === health.id);
    expect(childrenAfter).toHaveLength(3);
    expect(childrenAfter.map((c) => c.i18nKey).sort()).toEqual(childrenBefore.map((c) => c.i18nKey).sort());

    const medicos = after.find((c) => c.id === health.id);
    expect(medicos?.name).toBe("Médicos");
    expect(medicos?.isSystem).toBe(false);
    expect(medicos?.archivedAt).toBeNull();
  });

  it("una categoría desprendida y archivada A MANO no se revive sola al cambiar de plantilla", async () => {
    await applyCategoryTemplate(householdId, "complete", userId, new Set());
    const first = await categoriesRepo.list(householdId);
    const health = first.find((c) => c.i18nKey === "health")!;
    await categoriesRepo.update(health.id, { name: "Médicos" });
    await categoriesRepo.archive(health.id);

    // "basic" también incluye "health" — pasar por "scratch" primero fuerza
    // a que la próxima aplicación ejercite `createOrReviveOne` de nuevo
    // sobre esa clave (si tomara el camino equivocado, la revive acá).
    await applyCategoryTemplate(householdId, "scratch", userId, new Set());
    await applyCategoryTemplate(householdId, "basic", userId, new Set());

    const after = await categoriesRepo.get(health.id);
    expect(after?.archivedAt).not.toBeNull();
  });
});
