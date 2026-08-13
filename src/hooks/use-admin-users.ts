"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminRepo } from "@/lib/repos/admin-repo";

/** Prefijo común de las tres query keys del panel de operador — invalidarlo
 * de una alcanza para las tres, ver `useInvalidateAdmin`. */
export const ADMIN_KEY = ["admin"] as const;
export const ACCESS_REQUESTS_KEY = ["admin", "access-requests"] as const;
export const METRICS_KEY = ["admin", "metrics"] as const;
export const PENDING_COUNT_KEY = ["admin", "pending-count"] as const;

export function useAccessRequests(enabled: boolean) {
  return useQuery({
    queryKey: ACCESS_REQUESTS_KEY,
    queryFn: () => adminRepo.listAccessRequests(),
    enabled,
  });
}

/**
 * Un usuario puntual, leído del mismo cache que `useAccessRequests` (misma
 * query key + queryFn, `select` recorta al perfil pedido) — no existe una
 * RPC de detalle individual, así que el detalle de `/more/admin/users`
 * nunca dispara un fetch propio: reutiliza la lista completa que la
 * pantalla ya cargó. `select` corre en cada render de la lista, pero
 * React Query memoiza el resultado hasta que el array de origen cambia.
 */
export function useAccessRequest(profileId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ACCESS_REQUESTS_KEY,
    queryFn: () => adminRepo.listAccessRequests(),
    enabled,
    select: (data) => data.find((u) => u.profileId === profileId) ?? null,
  });
}

/**
 * Invalida las TRES query keys de admin de una — `access-requests`,
 * `metrics` y `pending-count`. Antes de esto, `setAccessStatus` solo
 * invalidaba las primeras dos y el badge de pendientes del tab "Más"
 * (`usePendingAccessRequestsCount`, que lee `metrics().pending` con
 * `refetchInterval: 60_000`) quedaba desfasado hasta un minuto después de
 * aprobar o rechazar una solicitud.
 */
export function useInvalidateAdmin() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
  }, [queryClient]);
}
