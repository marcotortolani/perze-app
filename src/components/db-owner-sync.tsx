"use client";

import { useEffect } from "react";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { getDb, switchToUserDb } from "@/lib/db/client";

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
 */
export function DbOwnerSync() {
  const userId = useCurrentUserId();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      const legacyHasHousehold = (await getDb().households.count()) > 0;
      if (cancelled) return;
      if (legacyHasHousehold) return; // ver nota de migración arriba
      switchToUserDb(userId);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return null;
}
