"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { categoriesRepo } from "@/lib/repos/categories-repo";

export function categoriesKey(householdId: string) {
  return ["categories", householdId] as const;
}

export function useCategories(householdId: string | undefined) {
  return useQuery({
    queryKey: categoriesKey(householdId ?? ""),
    queryFn: () => categoriesRepo.list(householdId!),
    enabled: !!householdId,
  });
}

export function useInvalidateCategories(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return () => householdId && queryClient.invalidateQueries({ queryKey: categoriesKey(householdId) });
}
