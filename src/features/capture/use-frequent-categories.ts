import { useMemo } from "react";
import type { CategoryRow, TransactionRow } from "@/lib/db/schema";
import { rankRecentCategoriesByUsage } from "@/lib/analytics/category-usage";

/**
 * Top de C1/C2 por uso real (`rankRecentCategoriesByUsage`) — reemplaza el
 * stub que devolvía las primeras `count` por `sortOrder`. `CaptureFlow`
 * pide las transacciones una sola vez y las pasa acá y a `CategoryStep`,
 * que siguen siendo presentacionales. `now` no puede resolverse acá adentro
 * con `new Date()` en cada render sin desestabilizar el memo — se pasa
 * explícito, capturado una vez por `CaptureFlow`.
 */
export function useFrequentCategories(
  categories: CategoryRow[] | undefined,
  transactions: TransactionRow[] | undefined,
  kind: "expense" | "income",
  now: Date,
  limit = 5
): CategoryRow[] {
  const nowMs = now.getTime();
  return useMemo(() => {
    if (!categories) return [];
    return rankRecentCategoriesByUsage(categories, transactions ?? [], { kind, limit, now: new Date(nowMs) });
  }, [categories, transactions, kind, limit, nowMs]);
}
