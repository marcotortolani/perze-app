import type { CategoryRow } from "@/lib/db/schema";

/**
 * `categoryId` más sus subcategorías directas. La jerarquía de categorías
 * tiene exactamente dos niveles por decisión de producto (raíz → hijos, sin
 * nietos — ver `CategorySheet.tsx`), así que un solo filtro alcanza: no
 * hace falta recursión. Incluye subcategorías archivadas a propósito, para
 * que un presupuesto siga sumando el gasto histórico de una subcategoría
 * que después se apagó.
 */
export function getCategoryAndDescendantIds(categoryId: string, categories: readonly Pick<CategoryRow, "id" | "parentId">[]): Set<string> {
  const ids = new Set<string>([categoryId]);
  for (const c of categories) {
    if (c.parentId === categoryId) ids.add(c.id);
  }
  return ids;
}
