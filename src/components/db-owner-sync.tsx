"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { getActiveDbName, getDb, switchToUserDb } from "@/lib/db/client";
import { clearDemoCookie } from "@/lib/demo/demo-mode";
import { DEMO_USER_ID } from "@/lib/demo-user";

/**
 * B4 — namespacea la base Dexie por usuario (`perze-${userId}`) apenas hay
 * sesión real. Cubre el caso que `signOut()` por sí solo no alcanza a
 * cubrir: alguien cierra la pestaña sin cerrar sesión y otra persona abre
 * la app en el mismo navegador con SU cuenta — sin este switch, vería los
 * datos de la sesión anterior en la base compartida `"perze"`.
 *
 * No hace nada mientras `userId` es `undefined` (todavía cargando) o
 * `null` (sin sesión, incluida la demo) — ahí la base sigue siendo la
 * anónima/demo (`switchToAnonymousDb()`, que corre en `signOut()` y al
 * arrancar el módulo).
 *
 * Salvaguarda de migración: si la base legacy `"perze"` YA tiene un
 * household (instalaciones de antes de este fix) y la base namespaced
 * todavía no, no se cambia — cambiar acá abandonaría en silencio los datos
 * reales del usuario en una base que nadie vuelve a abrir. El namespacing
 * aplica de lleno recién para sesiones nuevas en un dispositivo limpio.
 *
 * Excepción a la salvaguarda: el household de demo (§0, sembrado por
 * `seedDemoHousehold()` con `createdBy = DEMO_USER_ID`). Sin distinguirlo,
 * alguien que exploró el demo y después se registró quedaba clavado para
 * siempre en la base anónima mirando los datos de ejemplo — la salvaguarda
 * lo leía como "datos reales legacy" y nunca cambiaba a la base del
 * usuario. El demo no tiene nada real que perder: se borra entero (base y
 * cookie) y recién ahí se namespacea.
 */
export function DbOwnerSync() {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      const before = getActiveDbName();
      // Solo inspecciona/borra la base anónima — si otro efecto ya cambió a
      // la base del usuario, no hay nada legacy ni demo que evaluar acá.
      if (before === "perze") {
        const households = await getDb().households.toArray();
        if (cancelled) return;
        const isDemoLeftover = households.some((h) => h.createdBy === DEMO_USER_ID);
        if (isDemoLeftover) {
          clearDemoCookie();
          await getDb().delete();
          if (cancelled) return;
        } else if (households.length > 0) {
          return; // ver nota de migración arriba
        }
      }
      switchToUserDb(userId);
      // AC-4 (`docs/auditoria-acceso.md`) — cambiar de base Dexie invalida
      // TODO lo cacheado contra la base anterior: con `staleTime: Infinity`,
      // un household resuelto contra la base anónima seguía sirviéndose
      // después del cambio a `perze-<uid>` como si fuera del usuario.
      if (getActiveDbName() !== before) {
        void queryClient.invalidateQueries();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, queryClient]);

  return null;
}
