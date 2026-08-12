"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { accountGroupsRepo } from "@/lib/repos/account-groups-repo";

export function accountGroupsKey(householdId: string) {
  return ["account-groups", householdId] as const;
}

export function useAccountGroups(householdId: string | undefined) {
  return useQuery({
    queryKey: accountGroupsKey(householdId ?? ""),
    queryFn: () => accountGroupsRepo.list(householdId!),
    enabled: !!householdId,
  });
}

export function useInvalidateAccountGroups(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return () => householdId && queryClient.invalidateQueries({ queryKey: accountGroupsKey(householdId), refetchType: "all" });
}
