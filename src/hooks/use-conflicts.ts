"use client";

import { useQuery } from "@tanstack/react-query";
import { conflictsRepo } from "@/lib/repos/conflicts-repo";

/**
 * Los conflictos viven solo en Dexie (nunca en Supabase) y los escribe
 * `sync-worker.ts` en segundo plano, fuera del outbox normal de mutaciones
 * — pero siguen siendo una lectura local como cualquier otra, así que
 * `useQuery` + `refetch()` tras resolver uno alcanza, sin inventar un
 * mecanismo de refresco aparte.
 */
export function useConflicts(householdId: string | undefined) {
  const query = useQuery({
    queryKey: ["conflicts", householdId ?? ""],
    queryFn: () => conflictsRepo.listForHousehold(householdId!),
    enabled: !!householdId,
  });

  return { conflicts: query.data ?? [], refresh: query.refetch };
}
