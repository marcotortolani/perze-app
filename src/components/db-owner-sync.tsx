"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { getActiveDbName, getDb, switchToUserDb } from "@/lib/db/client";
import { clearDemoCookie } from "@/lib/demo/demo-mode";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { useDbOwnerStore } from "@/stores/db-owner-store";

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
  const setSettled = useDbOwnerStore((s) => s.setSettled);

  useEffect(() => {
    // AC-18 — `settled` le dice a `OnboardingGate` que la base activa ya es
    // la correcta para esta sesión: hasta entonces, una query de household
    // contra la base anónima devuelve un `null` falso y el gate mostraba
    // `/onboarding` en cada reload con sesión viva.
    if (userId === undefined) return; // auth todavía resolviendo — sin veredicto
    if (userId === null) {
      // Sin sesión (o demo): la base anónima ES la correcta.
      setSettled(true);
      return;
    }

    setSettled(false);
    let cancelled = false;

    (async () => {
      // Sin `try`/`finally` acá, un rechazo en cualquier paso (Dexie
      // cerrada a mitad de operación por otra pestaña, `invalidateQueries()`
      // esperando una query que nunca resuelve sin sesión — pasa hoy con
      // `debts`/`investments`, ver los tests en skip de
      // `e2e/navigation-replace.spec.ts`) dejaba `settled` en `false` para
      // siempre: `OnboardingGate` mostraba su spinner en TODA la app sin
      // salida posible salvo un reload manual. El `finally` garantiza que
      // el gate se libera pase lo que pase, y el `catch` deja el error
      // visible en vez de tragárselo en silencio dentro de una IIFE.
      try {
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
          } else if (households.length > 0 && households.every((h) => h.createdBy === userId)) {
            // AC-5 acotada: la salvaguarda solo aplica si los datos legacy son
            // DE ESTA sesión. Antes se quedaba en `perze` con cualquier
            // household no-demo — una segunda cuenta en el mismo navegador
            // (cambio de sesión sin `signOut`) veía los datos de la primera.
            return; // ver nota de migración arriba — la base legacy queda activa a propósito
          }
          // Household legacy de OTRO usuario: no se muestra ni se borra — queda
          // en `perze` intacto para su dueño; esta sesión abre su propia base.
        }
        switchToUserDb(userId);
        // AC-4 (`docs/auditoria-acceso.md`) — cambiar de base Dexie invalida
        // TODO lo cacheado contra la base anterior: con `staleTime: Infinity`,
        // un household resuelto contra la base anónima seguía sirviéndose
        // después del cambio a `perze-<uid>` como si fuera del usuario.
        // Se ESPERA el refetch (AC-18): si `settled` se marcara antes, el
        // gate leería todavía el `null` viejo de la base anónima y el flash
        // de `/onboarding` volvería por otra puerta.
        if (getActiveDbName() !== before) {
          await queryClient.invalidateQueries();
        }
      } catch (error) {
        console.error("[DbOwnerSync] no se pudo resolver la base activa de esta sesión — se libera igual el gate para no dejar la app clavada en el spinner", error);
      } finally {
        if (!cancelled) setSettled(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, queryClient, setSettled]);

  return null;
}
