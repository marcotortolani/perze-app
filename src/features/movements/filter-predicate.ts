import type { TransactionRow as TransactionRecord } from "@/lib/db/schema";
import type { MovementsFilters } from "./MovementsFiltersSheet";

/**
 * Los filtros de la lista de movimientos MENOS el rango de fecha.
 *
 * Vive suelto y no adentro de la pantalla porque tiene dos consumidores que
 * necesitan exactamente el mismo criterio: la lista, que lo combina con el
 * rango para decidir qué filas muestra, y el heatmap del calendario, que
 * codifica en color el gasto por día **bajo los filtros activos**. Si cada uno
 * lo reimplementara, filtrar por una categoría pintaría una cosa y listaría
 * otra.
 *
 * La fecha queda deliberadamente afuera: es el eje que el propio calendario
 * maneja. Si el heatmap se calculara con el rango aplicado, elegir un día
 * apagaría el resto del mes y la visualización se borraría a sí misma.
 */
export function matchesNonDateFilters(
  tx: TransactionRecord,
  filters: MovementsFilters,
  tagIdsByTx: Map<string, string[]>,
  payeeId: string | null
): boolean {
  if (filters.kind !== "all" && tx.kind !== filters.kind) return false;
  if (filters.accountIds.length > 0 && !filters.accountIds.includes(tx.accountId)) return false;
  if (filters.categoryIds.length > 0 && (!tx.categoryId || !filters.categoryIds.includes(tx.categoryId))) return false;
  if (filters.recurringIds.length > 0 && (!tx.recurringId || !filters.recurringIds.includes(tx.recurringId))) return false;
  if (filters.tagIds.length > 0) {
    const txTagIds = tagIdsByTx.get(tx.id) ?? [];
    if (!filters.tagIds.some((id) => txTagIds.includes(id))) return false;
  }
  if (filters.onlyPending && tx.fxRate !== null) return false;
  if (payeeId && tx.payeeId !== payeeId) return false;
  return true;
}
