"use client";

import { useEffect } from "react";

/**
 * Serwist no inyecta el registro solo (a diferencia de `next-pwa`) — sin
 * este componente el service worker nunca se activaba, con ningún paquete.
 * La URL es `/serwist/sw.js` (la route handler de `@serwist/turbopack`,
 * ver `src/app/serwist/[path]/route.ts`), no `/sw.js`.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/serwist/sw.js", { scope: "/" }).catch(() => {
      // Sin red en el primer registro, navegador viejo, etc. — la app
      // sigue andando igual, solo sin el offline fallback del SW.
    });
  }, []);

  return null;
}
