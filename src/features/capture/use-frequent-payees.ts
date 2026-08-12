import { useMemo } from "react";
import type { PayeeRow, TransactionRow } from "@/lib/db/schema";
import { rankPayeesByUsage } from "@/lib/analytics/payee-usage";

/** Top-5 de `DetailsSheet` por uso real — mismo espíritu que `useFrequentTags`. */
export function useFrequentPayees(payees: PayeeRow[] | undefined, transactions: TransactionRow[] | undefined, limit = 5): PayeeRow[] {
  return useMemo(() => {
    if (!payees) return [];
    return rankPayeesByUsage(payees, transactions ?? [], limit);
  }, [payees, transactions, limit]);
}
