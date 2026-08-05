"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffectiveUserId } from "./use-current-user";
import { profilesRepo, type OwnAccess } from "@/lib/repos/profiles-repo";

const OWN_ACCESS_KEY = ["auth", "own-access"] as const;

/**
 * `access_status`/`is_app_admin` de la propia sesión — usado para mostrar u
 * ocultar la entrada al panel del operador en Más (`morePage`) y para
 * gatear `/(app)/more/admin` del lado cliente. Nunca es la única barrera:
 * las tres RPC del operador (`adminRepo`) validan `is_app_admin()` de
 * nuevo, server-side, con `SECURITY DEFINER`.
 */
export function useOwnAccess(): OwnAccess | undefined {
  const userId = useEffectiveUserId();
  const { data } = useQuery({
    queryKey: [...OWN_ACCESS_KEY, userId],
    queryFn: () => profilesRepo.getOwnAccess(userId as string),
    enabled: !!userId,
    staleTime: 60_000,
  });
  return data ?? undefined;
}
