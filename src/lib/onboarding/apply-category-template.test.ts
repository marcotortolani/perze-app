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
});
