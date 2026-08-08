"use client";

import { useEffect, useRef } from "react";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { useOnlineStatus } from "@/hooks/use-online-status";

/**
 * Deja el home (`/`, el `start_url` del manifest) guardado en el cache de
 * navegación del service worker, para que tocar el ícono de la PWA sin
 * conexión abra la app en vez del fallback `/offline`.
 *
 * Esto existe porque `/` no puede precachearse: el service worker se
 * instala en la primera visita, que es sin sesión, y ahí `proxy.ts`
 * redirige `/` a `/start` — Serwist guardaría la landing bajo la clave del
 * home y la serviría cache-first por encima de la red hasta el próximo
 * deploy (el detalle completo está en
 * `scripts/build-sw.mjs`). Pedirlo desde acá invierte el orden:
 * primero hay sesión, después se guarda, así que lo que queda en el cache
 * es el home de verdad.
 *
 * Una sola vez por carga, y solo cuando hay algo que ganar: con sesión
 * confirmada (`userId` string — con `null`/`undefined` la respuesta sería
 * otra redirección), con red, y con un service worker que ya controla esta
 * página. El trabajo lo hace el propio SW (`WARM_HOME` en `src/app/sw.ts`),
 * que es el único que conoce el nombre real del cache.
 *
 * Falla en silencio a propósito: si no anda, el peor caso es el de hoy —
 * `/offline`, que desde este cambio ofrece el camino a cargar un
 * movimiento igual.
 */
export function PagesCacheWarmup() {
  const userId = useCurrentUserId();
  const online = useOnlineStatus();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !online || typeof userId !== "string") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    done.current = true;
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.active?.postMessage("WARM_HOME");
      })
      .catch(() => {
        // Sin service worker registrado (dev, o navegador que no lo
        // soporta) no hay cache que calentar y no hay nada que reportar.
      });
  }, [userId, online]);

  return null;
}
