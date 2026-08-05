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
  return () => householdId && queryClient.invalidateQueries({ queryKey: accountsKey(householdId), refetchType: "all" });
}

export function accountKey(id: string) {
  return ["account", id] as const;
}

export function useAccount(id: string | undefined) {
  return useQuery({
    queryKey: accountKey(id ?? ""),
    // `?? ""`: `enabled: false` deja el queryFn sin correr, pero React
    // Query igual exige que la función tipe un resultado no-`undefined`.
    queryFn: () => accountsRepo.get(id ?? ""),
    enabled: !!id,
  });
}

/**
 * Invalida el detalle de UNA cuenta puntual — `useInvalidateAccounts` (la
 * lista) no alcanza a esto: son dos query keys distintas (`["accounts",
 * householdId]` vs `["account", id]`). Sin esto, archivar/desarchivar una
 * cuenta y volver a abrir la MISMA cuenta seguía mostrando el estado
 * viejo (p. ej. el botón "Archivar" en vez de "Desarchivar") hasta un
 * reload manual.
 */
export function useInvalidateAccount(id: string | undefined) {
  const queryClient = useQueryClient();
  return () => id && queryClient.invalidateQueries({ queryKey: accountKey(id), refetchType: "all" });
}
