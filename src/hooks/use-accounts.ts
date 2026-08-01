"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { accountsRepo } from "@/lib/repos/accounts-repo";

export function accountsKey(householdId: string) {
  return ["accounts", householdId] as const;
}

export function useAccounts(householdId: string | undefined) {
  return useQuery({
    queryKey: accountsKey(householdId ?? ""),
    queryFn: () => accountsRepo.list(householdId!),
    enabled: !!householdId,
  });
}

export function useInvalidateAccounts(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return () => householdId && queryClient.invalidateQueries({ queryKey: accountsKey(householdId) });
}

export function useAccount(id: string | undefined) {
  return useQuery({
    queryKey: ["account", id ?? ""],
    // `?? ""`: `enabled: false` deja el queryFn sin correr, pero React
    // Query igual exige que la función tipe un resultado no-`undefined`.
    queryFn: () => accountsRepo.get(id ?? ""),
    enabled: !!id,
  });
}
