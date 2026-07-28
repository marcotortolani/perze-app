import type { CategoryRow } from "@/lib/db/schema";

/**
 * Frecuentes de C1/C2 — `docs/03-prompts-wireframes.md` § C2 pide
 * ponderar por hora del día. Todavía no hay estadística real de uso
 * (eso llega con las primeras semanas de datos reales); mientras tanto,
 * las primeras `count` categorías del tipo pedido, en su `sortOrder`.
 * Reemplazar por un ranking real en cuanto exista historial de movimientos.
 */
export function useFrequentCategories(categories: CategoryRow[] | undefined, kind: "expense" | "income", count = 3): CategoryRow[] {
  if (!categories) return [];
  return categories.filter((c) => c.kind === kind).slice(0, count);
}
