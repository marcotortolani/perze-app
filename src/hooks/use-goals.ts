"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { goalsRepo } from "@/lib/repos/goals-repo";

export function goalsKey(householdId: string) {
  return ["goals", householdId] as const;
}

export function useGoals(householdId: string | undefined) {
  return useQuery({
    queryKey: goalsKey(householdId ?? ""),
    queryFn: () => goalsRepo.list(householdId!),
    enabled: !!householdId,
  });
}

export function useInvalidateGoals(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return () => householdId && queryClient.invalidateQueries({ queryKey: goalsKey(householdId), refetchType: "all" });
}
