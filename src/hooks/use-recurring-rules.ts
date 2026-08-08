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

/**
 * Una sola regla por id, sin filtrar por `archivedAt` (a diferencia de
 * `useRecurringRules`/`.list()`) — un movimiento viejo de una regla ya
 * archivada tiene que poder seguir mostrando su nombre en el detalle.
 */
export function useRecurringRule(id: string | undefined) {
  return useQuery({
    queryKey: ["recurring-rule", id ?? ""],
    queryFn: () => recurringRulesRepo.get(id ?? ""),
    enabled: !!id,
  });
}

export function useInvalidateRecurringRules(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return () => householdId && queryClient.invalidateQueries({ queryKey: recurringRulesKey(householdId), refetchType: "all" });
}
