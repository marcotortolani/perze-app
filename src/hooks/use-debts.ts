"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { debtsRepo } from "@/lib/repos/debts-repo";

export function debtsKey(householdId: string) {
  return ["debts", householdId] as const;
}

export function useDebts(householdId: string | undefined) {
  return useQuery({
    queryKey: debtsKey(householdId ?? ""),
    queryFn: () => debtsRepo.listByHousehold(householdId!),
    enabled: !!householdId,
  });
}

export function useDebtsByAccount(accountId: string | undefined) {
  return useQuery({
    queryKey: ["debts-by-account", accountId ?? ""],
    queryFn: () => debtsRepo.listByAccount(accountId!),
    enabled: !!accountId,
  });
}

export function useDebt(id: string | undefined) {
  return useQuery({
    queryKey: ["debt", id ?? ""],
    queryFn: () => debtsRepo.get(id!),
    enabled: !!id,
  });
}

export function useDebtSchedule(debtId: string | undefined) {
  return useQuery({
    queryKey: ["debt-schedule", debtId ?? ""],
    queryFn: () => debtsRepo.listSchedule(debtId!),
    enabled: !!debtId,
  });
}

export function useInvalidateDebts(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return () => householdId && queryClient.invalidateQueries({ queryKey: debtsKey(householdId), refetchType: "all" });
}
