"use client";

import { useQuery } from "@tanstack/react-query";
import { listMyHouseholds, type RemoteHouseholdSummary } from "@/lib/repos/households-remote";
import { useEffectiveUserId } from "./use-current-user";
import { isDemoModeActive } from "@/lib/demo/demo-mode";

export const householdsListKey = ["households", "mine"] as const;

/**
 * Lista de TODOS los households del usuario — la usa "sumar cuenta al
 * grupo" (PR 5) para elegir destino. Nace acá y el household switcher
 * (PR 3, `feat/household-switcher`) la reusa tal cual: mismo hook, misma
 * key `["households","mine"]`. A diferencia de esa versión, esta NO tiene
 * fallback offline — mover una cuenta ya requiere una RPC en vivo (no hay
 * outbox para esto), así que no tiene sentido ofrecer el picker sin red.
 * El demo nunca tiene sesión de Supabase real, así que ahí la query queda
 * deshabilitada — no hay nada que listar.
 */
export function useHouseholdsList() {
  const userId = useEffectiveUserId();
  const demo = isDemoModeActive();
  return useQuery<RemoteHouseholdSummary[]>({
    queryKey: householdsListKey,
    queryFn: () => listMyHouseholds(userId!),
    enabled: !!userId && !demo,
    staleTime: 5 * 60 * 1000,
  });
}
