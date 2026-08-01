import type { NewCategoryInput } from "@/lib/repos/categories-repo";
import type { CategoryRow, Visibility } from "@/lib/db/schema";
import { normalize } from "@/lib/search/rank";

const DATA_COLORS = ["var(--data-1)", "var(--data-2)", "var(--data-3)", "var(--data-4)", "var(--data-5)"];

/**
 * Primera entrada de UI a `categoriesRepo.create()` — hasta acá tenía cero
 * llamadores. Defaults calcados de lo que ya escriben
 * `apply-category-template.ts` / `complete-onboarding.ts` / `demo-household.ts`
 * para una categoría de plantilla, salvo lo que corresponde a "esto lo
 * creó el usuario, no un seed": `i18nKey: null` (`schema.ts` es explícito:
 * sin `i18nKey` se muestra `name` tal cual) e `isSystem: false`.
 */
export function buildNewCategoryInput(input: {
  householdId: string;
  name: string;
  kind: "expense" | "income";
  createdBy: string;
  existing: CategoryRow[];
  defaultVisibility?: Visibility;
}): NewCategoryInput {
  const maxSortOrder = input.existing.reduce((max, c) => Math.max(max, c.sortOrder), -1);
  return {
    householdId: input.householdId,
    parentId: null,
    name: input.name.trim(),
    i18nKey: null,
    icon: "tag",
    color: DATA_COLORS[input.existing.length % DATA_COLORS.length]!,
    kind: input.kind,
    nature: "variable",
    isSystem: false,
    sortOrder: maxSortOrder + 1,
    visibility: input.defaultVisibility ?? "household",
    ownerId: null,
    createdBy: input.createdBy,
  };
}

/**
 * Antes de crear, ¿ya existe una categoría con ese nombre (sin distinguir
 * acentos/mayúsculas)? Si sí, se selecciona esa en vez de duplicar —
 * `normalize` es el mismo helper del buscador (`src/lib/search/rank.ts`).
 */
export function findExistingCategoryByName(name: string, existing: CategoryRow[], kind: "expense" | "income", categoryLabel: (c: CategoryRow) => string): CategoryRow | undefined {
  const needle = normalize(name);
  return existing.find((c) => c.kind === kind && normalize(categoryLabel(c)) === needle);
}
