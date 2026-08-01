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
 */
export async function applyCategoryTemplate(householdId: string, choice: CategoryTemplateChoice, userId: string, usedCategoryIds: Set<string>): Promise<void> {
  const existing = await categoriesRepo.list(householdId);
  const unusedSystemCategories = existing.filter((c) => c.isSystem && !usedCategoryIds.has(c.id));

  for (const category of unusedSystemCategories) {
    await categoriesRepo.archive(category.id);
  }

  if (choice === "scratch") return;

  const template = choice === "complete" ? COMPLETE_CATEGORY_TEMPLATE : BASIC_CATEGORY_TEMPLATE;
  await createFromTemplate(householdId, userId, template);
}

async function createFromTemplate(householdId: string, userId: string, template: CategoryTemplateItem[]): Promise<void> {
  let sortOrder = 0;
  for (const item of template) {
    const parent = await createOne(householdId, userId, item, null, sortOrder++);
    for (const child of item.children ?? []) {
      await createOne(householdId, userId, child, parent.id, sortOrder++);
    }
  }
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
