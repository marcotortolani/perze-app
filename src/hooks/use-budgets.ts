"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetsRepo } from "@/lib/repos/budgets-repo";

export function budgetsKey(householdId: string) {
  return ["budgets", householdId] as const;
}

export function useBudgets(householdId: string | undefined) {
  return useQuery({
    queryKey: budgetsKey(householdId ?? ""),
    queryFn: () => budgetsRepo.list(householdId!),
    enabled: !!householdId,
  });
}

export function useInvalidateBudgets(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return () => householdId && queryClient.invalidateQueries({ queryKey: budgetsKey(householdId) });
}
