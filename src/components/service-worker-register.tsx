"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

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
export function ServiceWorkerRegister() {
  const t = useTranslations();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let reloaded = false;
    const onControllerChange = () => {
      // Evita el loop clásico: `controllerchange` puede disparar más de
      // una vez si hay varias pestañas — solo recargamos la primera.
      if (reloaded) return;
      reloaded = true;
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
    };
  }, [t]);

  return null;
}
