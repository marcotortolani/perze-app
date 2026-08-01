import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";
import { defaultCache } from "@serwist/turbopack/worker";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * `defaultCache` (`@serwist/turbopack/worker`) ya trae estrategias razonables
 * para lo que Next.js sirve: NetworkFirst para navegaciones/RSC, CacheFirst
 * para fonts/imágenes/JS/CSS con hash. Encima de eso: `/offline` como
 * fallback de navegación (`src/app/offline/page.tsx`) — la app en sí es
 * local-first (Dexie/outbox), así que esto solo cubre una navegación nueva
 * a una ruta que todavía no está en caché sin red, nunca el guardado de datos.
 */
/**
 * B5/C25 — `defaultCache` (en producción) trae un `NetworkFirst` de 24h
 * para todo `/api/*` (cache `"apis"`). Eso incluye `/api/fx`: una respuesta
 * con el override manual de un household, o directamente un 401, quedaba
 * en CacheStorage sin purga posible (no había logout, ver B4) — la
 * cotización de ayer se servía como si fuera de hoy sin tocar la red. Esta
 * regla va ANTES de `...defaultCache` a propósito: el primer matcher que
 * coincide gana, así que esto le gana a la regla `NetworkFirst` de más
 * abajo para cualquier `/api/*`, sin tocar el resto de `defaultCache`.
 */
const API_NETWORK_ONLY: RuntimeCaching = {
  matcher: ({ sameOrigin, url: { pathname } }) => sameOrigin && pathname.startsWith("/api/"),
  handler: new NetworkOnly(),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [API_NETWORK_ONLY, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

/**
 * K12 — push. El payload lo arma la Edge Function `send-push` (nunca el
 * cliente): `{title, body, url}`. Sin payload (algunos proveedores mandan
 * push vacíos como wake-up) se muestra un texto genérico en vez de fallar.
 */
self.addEventListener("push", (event) => {
  let payload: { title?: string; body?: string; url?: string } = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = {};
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "PERZE", {
      body: payload.body ?? "",
      icon: "/icon.svg",
      data: { url: payload.url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/";
  event.waitUntil(self.clients.openWindow(url));
});
