import { getDb } from "../db/client";
import { categoriesRepo } from "../repos/categories-repo";
import { BASIC_CATEGORY_TEMPLATE, COMPLETE_CATEGORY_TEMPLATE, type CategoryTemplateItem } from "../reference/category-templates";
import type { CategoryRow } from "../db/schema";

export type CategoryTemplateChoice = "basic" | "complete" | "scratch";

/**
 * A8, fuera del camino crítico. Nunca reemplaza categorías existentes ni
 * las borra: `isSystem` de la plantilla vieja se archiva (soft-delete,
 * CLAUDE.md § "apagar oculta, nunca borra" aplica igual acá) solo si nadie
 * la usó todavía; las que ya tienen un movimiento cargado quedan como
 * están, con o sin plantilla nueva encima.
 *
 * Antes de esto: cualquier categoría CON uso sobrevivía al archivado y
 * `createFromTemplate` la recreaba igual, sin condición — "Supermercado" u
 * "Otros ingresos" quedaban duplicados apenas el household tenía algún
 * movimiento cargado contra ellas. Ahora se reconcilia por `i18nKey`
 * (identidad estable de una categoría de plantilla, a diferencia del
 * `name` traducido): lo que ya existe —usado o archivado— no se vuelve a
 * crear; lo archivado que reaparece en la plantilla nueva se revive en vez
 * de duplicarse.
 */
export async function applyCategoryTemplate(householdId: string, choice: CategoryTemplateChoice, userId: string, usedCategoryIds: Set<string>): Promise<void> {
  // `categoriesRepo.list` filtra los archivados — acá hace falta verlos
  // también, para revivir en vez de duplicar.
  const allExisting = await getDb().categories.where("householdId").equals(householdId).toArray();
  const existing = allExisting.filter((c) => c.archivedAt === null);

  const template = choice === "scratch" ? [] : choice === "complete" ? COMPLETE_CATEGORY_TEMPLATE : BASIC_CATEGORY_TEMPLATE;
  const templateKeys = new Set(flattenTemplate(template).map((item) => item.i18nKey));

  const unusedSystemCategories = existing.filter((c) => c.isSystem && !usedCategoryIds.has(c.id) && !(c.i18nKey && templateKeys.has(c.i18nKey)));
  for (const category of unusedSystemCategories) {
    await categoriesRepo.archive(category.id);
  }

  if (choice === "scratch") return;

  await createFromTemplate(householdId, userId, template, allExisting);
}

function flattenTemplate(template: CategoryTemplateItem[]): CategoryTemplateItem[] {
  return template.flatMap((item) => [item, ...(item.children ?? [])]);
}

async function createFromTemplate(householdId: string, userId: string, template: CategoryTemplateItem[], allExisting: CategoryRow[]): Promise<void> {
  const byI18nKey = new Map(allExisting.filter((c) => c.i18nKey).map((c) => [c.i18nKey!, c]));
  let sortOrder = 0;
  for (const item of template) {
    const parent = await createOrReviveOne(householdId, userId, item, null, sortOrder++, byI18nKey);
    for (const child of item.children ?? []) {
      await createOrReviveOne(householdId, userId, child, parent.id, sortOrder++, byI18nKey);
    }
  }
}

async function createOrReviveOne(
  householdId: string,
  userId: string,
  item: CategoryTemplateItem,
  parentId: string | null,
  sortOrder: number,
  byI18nKey: Map<string, CategoryRow>
): Promise<CategoryRow> {
  const found = byI18nKey.get(item.i18nKey);
  if (found) {
    // Solo revive automáticamente si sigue siendo de la plantilla
    // (`isSystem`). Una fila desprendida por el usuario (`detachFromTemplate`
    // — editada, `isSystem: false`, pero con `i18nKey` intacto a propósito
    // para que ESTE `byI18nKey.get` la encuentre y no cree una duplicada) es
    // suya: si la archivó a mano, cambiar de plantilla no puede des-archivarla.
    if (found.isSystem && found.archivedAt !== null) await categoriesRepo.update(found.id, { archivedAt: null });
    return found;
  }
  return createOne(householdId, userId, item, parentId, sortOrder);
}

async function createOne(householdId: string, userId: string, item: CategoryTemplateItem, parentId: string | null, sortOrder: number): Promise<CategoryRow> {
  const [created] = await categoriesRepo.bulkCreate([
    {
      householdId,
      parentId,
      name: item.name,
      i18nKey: item.i18nKey,
      icon: item.icon,
      color: item.color,
      kind: item.kind,
      nature: "variable",
      isSystem: true,
      sortOrder,
      visibility: "household",
      ownerId: null,
      createdBy: userId,
    },
  ]);
  return created!;
}
