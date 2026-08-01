"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invitesRepo } from "@/lib/repos/invites-repo";

export function invitesKey(householdId: string) {
  return ["invites", householdId] as const;
}

export function useInvites(householdId: string | undefined) {
  return useQuery({
    queryKey: invitesKey(householdId ?? ""),
    queryFn: () => invitesRepo.listForHousehold(householdId!),
    enabled: !!householdId,
  });
}

export function useInvalidateInvites(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return () => householdId && queryClient.invalidateQueries({ queryKey: invitesKey(householdId) });
}
