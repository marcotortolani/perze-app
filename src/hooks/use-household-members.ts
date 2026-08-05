"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { householdsRepo } from "@/lib/repos/households-repo";

export function householdMembersKey(householdId: string) {
  return ["household-members", householdId] as const;
}

export function useHouseholdMembers(householdId: string | undefined) {
  return useQuery({
    queryKey: householdMembersKey(householdId ?? ""),
    queryFn: () => householdsRepo.listMembers(householdId!),
    enabled: !!householdId,
  });
}

export function useInvalidateHouseholdMembers(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return () => householdId && queryClient.invalidateQueries({ queryKey: householdMembersKey(householdId), refetchType: "all" });
}
