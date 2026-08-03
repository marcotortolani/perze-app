"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { transactionTagsRepo } from "@/lib/repos/transaction-tags-repo";

/** Los `tagId` de un movimiento puntual — para precargar `draft.tagIds` al editar. */
export function useTagIdsForTransaction(transactionId: string | undefined) {
  return useQuery({
    queryKey: ["transaction-tags", "one", transactionId ?? ""],
    queryFn: () => transactionTagsRepo.listForTransaction(transactionId!),
    enabled: !!transactionId,
  });
}

/**
 * Todas las asociaciones tag↔movimiento del set de `transactionIds` dado —
 * para rankear tags por uso (`rankTagsByUsage`) sin una query por
 * movimiento. La key incluye los ids ordenados (no solo la cantidad) para
 * que agregar/sacar un tag de un movimiento existente invalide bien.
 */
export function useTransactionTagsFor(transactionIds: string[]) {
  const key = [...transactionIds].sort().join(",");
  return useQuery({
    queryKey: ["transaction-tags", "many", key],
    queryFn: () => transactionTagsRepo.listForTransactions(transactionIds),
    enabled: transactionIds.length > 0,
  });
}

export function useInvalidateTransactionTags() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["transaction-tags"] });
}
