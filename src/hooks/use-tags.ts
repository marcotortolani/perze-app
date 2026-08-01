"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tagsRepo } from "@/lib/repos/tags-repo";

export function tagsKey(householdId: string) {
  return ["tags", householdId] as const;
}

export function useTags(householdId: string | undefined) {
  return useQuery({
    queryKey: tagsKey(householdId ?? ""),
    queryFn: () => tagsRepo.list(householdId!),
    enabled: !!householdId,
  });
}

export function useInvalidateTags(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return () => householdId && queryClient.invalidateQueries({ queryKey: tagsKey(householdId) });
}
