"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { payeesRepo } from "@/lib/repos/payees-repo";

export function payeesKey(householdId: string) {
  return ["payees", householdId] as const;
}

export function usePayees(householdId: string | undefined) {
  return useQuery({
    queryKey: payeesKey(householdId ?? ""),
    queryFn: () => payeesRepo.list(householdId!),
    enabled: !!householdId,
  });
}

export function useInvalidatePayees(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return () => householdId && queryClient.invalidateQueries({ queryKey: payeesKey(householdId) });
}
