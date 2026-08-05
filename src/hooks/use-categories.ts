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

export function archivedCategoriesKey(householdId: string) {
  return ["categories", householdId, "archived"] as const;
}

/** Solo las archivadas — las consume la sección "Archivadas" de `/more/categories`. */
export function useArchivedCategories(householdId: string | undefined) {
  return useQuery({
    queryKey: archivedCategoriesKey(householdId ?? ""),
    queryFn: () => categoriesRepo.listArchived(householdId!),
    enabled: !!householdId,
  });
}

export function useInvalidateCategories(householdId: string | undefined) {
  const queryClient = useQueryClient();
  // `["categories", householdId]` es prefijo de `archivedCategoriesKey`, así
  // que esta sola invalidación alcanza las dos: archivar o restaurar mueve
  // una categoría de una lista a la otra y las dos tienen que refrescar.
  return () => householdId && queryClient.invalidateQueries({ queryKey: categoriesKey(householdId), refetchType: "all" });
}
