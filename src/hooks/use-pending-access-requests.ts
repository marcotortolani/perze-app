"use client";

import { useQuery } from "@tanstack/react-query";
import { adminRepo } from "@/lib/repos/admin-repo";
import { useOwnAccess } from "./use-own-access";

const PENDING_ACCESS_REQUESTS_KEY = ["admin", "pending-count"] as const;

/**
 * Badge de "Más" (CON-13, `TabItem.badge` ya soporta esto — ver
 * `TabBar.tsx`) — cuántas solicitudes de acceso están esperando
 * aprobación. Solo corre para el operador (`is_app_admin`); para
 * cualquier otro usuario queda deshabilitada, sin round-trip de más.
 * `refetchInterval` porque es la única señal que tiene el operador de que
 * llegó una solicitud nueva mientras la app ya está abierta — sin polling
 * se enteraría recién al volver a entrar a "Más".
 */
export function usePendingAccessRequestsCount(): number {
  const ownAccess = useOwnAccess();
  const { data } = useQuery({
    queryKey: PENDING_ACCESS_REQUESTS_KEY,
    queryFn: async () => (await adminRepo.metrics()).pending,
    enabled: ownAccess?.isAppAdmin === true,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  return data ?? 0;
}
