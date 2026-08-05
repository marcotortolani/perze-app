"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { recurringRulesRepo } from "@/lib/repos/recurring-rules-repo";

export function recurringRulesKey(householdId: string) {
  return ["recurring-rules", householdId] as const;
}

export function useRecurringRules(householdId: string | undefined) {
  return useQuery({
    queryKey: recurringRulesKey(householdId ?? ""),
    queryFn: () => recurringRulesRepo.list(householdId!),
    enabled: !!householdId,
  });
}

export function useInvalidateRecurringRules(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return () => householdId && queryClient.invalidateQueries({ queryKey: recurringRulesKey(householdId), refetchType: "all" });
}
