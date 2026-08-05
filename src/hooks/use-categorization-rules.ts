"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { categorizationRulesRepo } from "@/lib/repos/categorization-rules-repo";

export function categorizationRulesKey(householdId: string) {
  return ["categorization-rules", householdId] as const;
}

export function useCategorizationRules(householdId: string | undefined) {
  return useQuery({
    queryKey: categorizationRulesKey(householdId ?? ""),
    queryFn: () => categorizationRulesRepo.list(householdId!),
    enabled: !!householdId,
  });
}

export function useInvalidateCategorizationRules(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return () => householdId && queryClient.invalidateQueries({ queryKey: categorizationRulesKey(householdId), refetchType: "all" });
}
