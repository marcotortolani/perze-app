"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getDb } from "@/lib/db/client";
import { listMyHouseholds, type RemoteHouseholdSummary } from "@/lib/repos/households-remote";
import { householdsRepo } from "@/lib/repos/households-repo";
import { profilesRepo } from "@/lib/repos/profiles-repo";
import { hydrateFromRemote } from "@/lib/offline/hydrate";
import { watermarkKeyFor } from "@/lib/offline/pull";
import { useEffectiveUserId } from "./use-current-user";
import { currentHouseholdKey } from "./use-current-household";
import { isDemoModeActive } from "@/lib/demo/demo-mode";

export const householdsListKey = ["households", "mine"] as const;

/**
 * Household switcher (PR 3) — la lista de TODOS los households del usuario.
 * Remota como fuente principal (Dexie no los tiene todos hasta que cada uno
 * se hidrata); fallback a la lista local si falla (offline). El demo nunca
 * tiene sesión de Supabase real (`enterDemoMode()` no crea una), así que ahí
 * la query queda deshabilitada — no hay nada que listar.
 */
export function useHouseholdsList() {
  const userId = useEffectiveUserId();
  const demo = isDemoModeActive();
  return useQuery<RemoteHouseholdSummary[]>({
    queryKey: householdsListKey,
    queryFn: async () => {
      try {
        return await listMyHouseholds(userId!);
      } catch {
        // Offline, o cualquier otro fallo de red — lo local siempre tiene
        // AL MENOS el household activo, y desde el fix de `hydrate.ts`
        // (PR 2) también los demás si alguna vez se hidrataron acá.
        const local = await householdsRepo.listLocal();
        return local.map((h) => ({ id: h.id, name: h.name, baseCurrency: h.baseCurrency, role: "member" as const }));
      }
    },
    enabled: !!userId && !demo,
    staleTime: 5 * 60 * 1000,
  });
}

export interface SwitchHouseholdResult {
  householdId: string;
}

/**
 * El cambio de household en sí — nunca accidental (se llama desde un tap
 * explícito en el Sheet del switcher, nunca de un gesto). En orden:
 * hidratar (saltea el fetch completo si el household ya está hidratado y al
 * día — mismo watermark que usa el pull incremental) → activar local →
 * activar en el servidor → limpiar TODO el cache de queries, porque buena
 * parte de las keys de la app no llevan `householdId` y una invalidación
 * selectiva acá es una fábrica de bugs. El caller navega a "/" después.
 */
export function useSwitchHousehold() {
  const queryClient = useQueryClient();
  return async (householdId: string): Promise<SwitchHouseholdResult> => {
    const db = getDb();
    const alreadyHydrated = (await db.households.get(householdId)) && (await db.meta.get(watermarkKeyFor(householdId)));
    if (!alreadyHydrated) {
      await hydrateFromRemote({ householdId });
    }
    await householdsRepo.setCurrentHouseholdId(householdId);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) void profilesRepo.setDefaultHousehold(user.id, householdId).catch(() => {});
    queryClient.clear();
    // `clear()` se lleva `currentHouseholdKey` también — se re-siembra para
    // que el próximo render no tenga que esperar el refetch.
    queryClient.setQueryData(currentHouseholdKey, await householdsRepo.get(householdId));
    return { householdId };
  };
}
