"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { transactionsRepo, type TransactionFilters } from "@/lib/repos/transactions-repo";

export function transactionsKey(householdId: string, filters: TransactionFilters = {}) {
  return ["transactions", householdId, filters] as const;
}

export function useTransactions(householdId: string | undefined, filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: transactionsKey(householdId ?? "", filters),
    queryFn: () => transactionsRepo.list(householdId!, filters),
    enabled: !!householdId,
  });
}

export function useInvalidateTransactions(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return () => householdId && queryClient.invalidateQueries({ queryKey: ["transactions", householdId] });
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: ["transaction", id ?? ""],
    // `?? null`: `enabled: false` deja el queryFn sin correr, pero React
    // Query igual exige que la función tipe un resultado no-`undefined`.
    queryFn: () => transactionsRepo.get(id ?? ""),
    enabled: !!id,
  });
}
