"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { env } from "@/env";

/**
 * Serwist no inyecta el registro solo (a diferencia de `next-pwa`) — sin
 * este componente el service worker nunca se activaba, con ningún paquete.
 * La URL es `/serwist/sw.js` (la route handler de `@serwist/turbopack`,
 * ver `src/app/serwist/[path]/route.ts`), no `/sw.js`.
 *
 * C18/auditoría: `sw.ts` ya no hace `skipWaiting` solo — cuando hay un
 * service worker nuevo esperando, esto lo detecta (`updatefound` +
 * `installed` con un controller ya activo, o `registration.waiting` si ya
 * estaba esperando al montar) y ofrece un toast persistente en vez de
 * romper la sesión en curso con un cambio de versión silencioso.
 */
/**
 * AC-16 (`docs/auditoria-acceso.md`) — un SW con precache viejo después de
 * un deploy sirve HTML que referencia chunks que ya no existen: la app
 * queda clavada (o loopea recargas) hasta que alguien limpia el service
 * worker a mano. Visto en producción el 2026-08-02. La marca vive en
 * sessionStorage con timestamp: UNA recuperación por ventana de 5 minutos
 * — si la recarga no arregló nada, no se insiste (eso sería recrear el
 * loop que se intenta evitar).
 */
const CHUNK_RECOVERY_KEY = "perze:chunkRecovery";
const CHUNK_RECOVERY_WINDOW_MS = 5 * 60_000;

function looksLikeChunkError(message: string): boolean {
  return /loading chunk|chunkloaderror|failed to fetch dynamically imported module|importing a module script failed/i.test(message);
}

async function recoverFromStaleCache(trigger: string): Promise<void> {
  const last = Number(window.sessionStorage.getItem(CHUNK_RECOVERY_KEY) ?? 0);
  if (Date.now() - last < CHUNK_RECOVERY_WINDOW_MS) return;
  window.sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(Date.now()));

  // Deja rastro ANTES de tocar nada. Esta función borra todo el Cache
  // Storage y recarga la página: es el segundo camino por el que la app
  // puede recargarse sola, y sin este log era indistinguible de un bug
  // —una "recarga misteriosa" en medio de cualquier pantalla—. Si algún
  // día un import dinámico falla por una razón que NO es un precache
  // viejo, el mensaje que lo disparó queda acá para verlo.
  console.warn("[perze/sw] recuperación por chunk que no carga: se borra el Cache Storage y se recarga. Disparado por:", trigger);

  // Purga el precache viejo y fuerza al SW a buscar la versión nueva antes
  // de la única recarga. Best-effort en cada paso: lo importante es llegar
  // al reload con el caché limpio.
  if (typeof caches !== "undefined") {
    const keys = await caches.keys().catch(() => []);
    await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)));
  }
  const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  await registration?.update().catch(() => {});
  registration?.waiting?.postMessage("SKIP_WAITING");
  window.location.reload();
}

/**
 * En `next dev` el service worker está apagado, y además desregistra el
 * que haya quedado de antes.
 *
 * Turbopack renombra los chunks en cada arranque del server, así que el
 * precache de la sesión anterior sirve un HTML que referencia archivos que
 * ya no existen: la app queda **en blanco, sin un solo error en consola**
 * —los pedidos se resuelven desde el cache, así que ni siquiera hay un
 * chunk error que dispare `recoverFromStaleCache()`— y la única salida es
 * borrar el service worker a mano desde DevTools. Nadie asocia una
 * pantalla blanca en localhost con un service worker.
 *
 * Desregistrar (y no solo "no registrar") es la parte importante: apagarlo
 * de acá en adelante no saca el que el navegador ya tiene instalado.
 */
const SW_ENABLED = env.NODE_ENV !== "development" || env.NEXT_PUBLIC_ENABLE_SW_IN_DEV === "1";

export function ServiceWorkerRegister() {
  const t = useTranslations();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (!SW_ENABLED) {
      void (async () => {
        const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
        if (registrations.length === 0) return;
        console.warn("[perze/sw] service worker de una sesión de desarrollo anterior: se desregistra y se limpia el Cache Storage.");
        await Promise.all(registrations.map((r) => r.unregister().catch(() => false)));
        if (typeof caches !== "undefined") {
          const keys = await caches.keys().catch(() => []);
          await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)));
        }
      })();
      return;
    }

    // AC-16 — chunks que fallan al cargar = precache desactualizado.
    const onError = (event: ErrorEvent) => {
      const text = event.message ?? "";
      if (looksLikeChunkError(text)) void recoverFromStaleCache(text);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { name?: string; message?: string } | undefined;
      const text = `${reason?.name ?? ""} ${reason?.message ?? ""}`;
      if (looksLikeChunkError(text)) void recoverFromStaleCache(text);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    let reloaded = false;
    const onControllerChange = () => {
      // Evita el loop clásico: `controllerchange` puede disparar más de
      // una vez si hay varias pestañas — solo recargamos la primera.
      if (reloaded) return;
      reloaded = true;
      // Igual que arriba: una recarga que el usuario no pidió deja rastro.
      // Esta es la esperada —el service worker nuevo tomó control— pero sin
      // el log las dos se ven idénticas desde afuera.
      console.warn("[perze/sw] el service worker nuevo tomó control: se recarga para servir la versión nueva.");
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const offerUpdate = (registration: ServiceWorkerRegistration) => {
      const waiting = registration.waiting;
      if (!waiting) return;
      toast(t("pwa.updateAvailable"), {
        duration: Infinity,
        action: {
          label: t("pwa.updateNow"),
          onClick: () => waiting.postMessage("SKIP_WAITING"),
        },
      });
    };

    navigator.serviceWorker
      .register("/serwist/sw.js", { scope: "/" })
      .then((registration) => {
        offerUpdate(registration);
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              offerUpdate(registration);
            }
          });
        });
      })
      .catch(() => {
        // Sin red en el primer registro, navegador viejo, etc. — la app
        // sigue andando igual, solo sin el offline fallback del SW.
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [t]);

  return null;
}
