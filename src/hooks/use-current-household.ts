"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { householdsRepo } from "@/lib/repos/households-repo";
import type { HouseholdRow } from "@/lib/db/schema";

export const currentHouseholdKey = ["household", "current"] as const;

/**
 * Household activo, o `null` si todavía no existe ninguno — a partir de la
 * Fase 9 (Bloque A) ya no se siembra un household demo automáticamente acá:
 * sin household, `(app)/layout.tsx` redirige a `/onboarding`. Para seguir
 * probando con datos de ejemplo, `/onboarding` ofrece un atajo que llama a
 * `seedDemoHousehold()` explícitamente.
 */
export function useCurrentHousehold() {
  return useQuery<HouseholdRow | null>({
    queryKey: currentHouseholdKey,
    queryFn: async () => {
      const id = await householdsRepo.getCurrentHouseholdId();
      const household = id ? await householdsRepo.get(id) : undefined;
      return household ?? null;
    },
    staleTime: Infinity,
  });
}

export function useInvalidateHousehold() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: currentHouseholdKey });
}
