"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listRemoteHouseholdMembers } from "@/lib/repos/household-members-remote";

export function remoteHouseholdMembersKey(householdId: string) {
  return ["remote-household-members", householdId] as const;
}

export function useRemoteHouseholdMembers(householdId: string | undefined) {
  return useQuery({
    queryKey: remoteHouseholdMembersKey(householdId ?? ""),
    queryFn: () => listRemoteHouseholdMembers(householdId!),
    enabled: !!householdId,
  });
}

export function useInvalidateRemoteHouseholdMembers(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return () => householdId && queryClient.invalidateQueries({ queryKey: remoteHouseholdMembersKey(householdId) });
}
