import { useMemo } from "react";
import type { TagRow } from "@/lib/db/schema";
import { rankTagsByUsage } from "@/lib/analytics/tag-usage";
import { useTransactionTagsFor } from "@/hooks/use-transaction-tags";

/** Top-5 de `DetailsSheet` por uso real — mismo espíritu que `useFrequentCategories`, sin ventana de 90 días (los tags son de bajo volumen, no hace falta la degradación a histórico completo). */
export function useFrequentTags(tags: TagRow[] | undefined, transactionIds: string[], limit = 5): TagRow[] {
  const { data: links } = useTransactionTagsFor(transactionIds);
  return useMemo(() => {
    if (!tags) return [];
    return rankTagsByUsage(tags, links ?? [], limit);
  }, [tags, links, limit]);
}
