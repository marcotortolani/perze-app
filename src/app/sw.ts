import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, NetworkOnly, StaleWhileRevalidate, Serwist } from "serwist";
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

/**
 * Fase 4 del plan de fluidez de navegación — ninguna de las reglas de
 * `defaultCache` para navegaciones (`pages`, `pages-rsc`,
 * `pages-rsc-prefetch`) trae `networkTimeoutSeconds`: son `NetworkFirst`
 * sin límite, así que con señal pobre una navegación espera a la red
 * indefinidamente en vez de caer al cache que ya tiene. Estas dos reglas
 * van ANTES de `...defaultCache` (gana el primer matcher, mismo patrón que
 * `API_NETWORK_ONLY`) y replican los matchers exactos de
 * `@serwist/turbopack` para RSC prefetch / RSC / documento, con la
 * diferencia de estrategia:
 *
 * - RSC de prefetch (`Next-Router-Prefetch: 1`): un prefetch por
 *   definición no debe bloquear nada — `StaleWhileRevalidate` sirve el
 *   cache al toque y revalida en segundo plano, nunca espera a la red.
 * - RSC/documento de una navegación real: `NetworkFirst` con
 *   `networkTimeoutSeconds: 3` — en 3 segundos sin respuesta cae al cache
 *   (o al fallback `/offline` si tampoco hay cache), en vez de colgarse.
 */
const NAVIGATION_PREFETCH_STALE_WHILE_REVALIDATE: RuntimeCaching = {
  matcher: ({ request, url: { pathname }, sameOrigin }) =>
    request.headers.get("RSC") === "1" && request.headers.get("Next-Router-Prefetch") === "1" && sameOrigin && !pathname.startsWith("/api/"),
  handler: new StaleWhileRevalidate({ cacheName: "pages-rsc-prefetch" }),
};

const NAVIGATION_RSC_NETWORK_FIRST_WITH_TIMEOUT: RuntimeCaching = {
  matcher: ({ request, url: { pathname }, sameOrigin }) => request.headers.get("RSC") === "1" && sameOrigin && !pathname.startsWith("/api/"),
  handler: new NetworkFirst({ cacheName: "pages-rsc", networkTimeoutSeconds: 3 }),
};

const NAVIGATION_HTML_NETWORK_FIRST_WITH_TIMEOUT: RuntimeCaching = {
  matcher: ({ request, url: { pathname }, sameOrigin }) =>
    request.headers.get("Content-Type")?.includes("text/html") === true && sameOrigin && !pathname.startsWith("/api/"),
  handler: new NetworkFirst({ cacheName: "pages", networkTimeoutSeconds: 3 }),
};

/**
 * B5/C25 (comentario original) también flagueaba que las respuestas de
 * Supabase caen en el bucket genérico `cross-origin` de `defaultCache`
 * (`NetworkFirst`, hasta 1h de cache) — respuestas autenticadas de
 * PostgREST quedando en CacheStorage sin purga por logout. Se matchea por
 * los prefijos de path que expone cualquier deployment de Supabase (cloud
 * o self-host detrás de Kong), no por hostname — así funciona igual para
 * quien haga self-host con un dominio propio.
 */
const SUPABASE_NETWORK_ONLY: RuntimeCaching = {
  matcher: ({ url: { pathname } }) => /^\/(rest|auth|realtime|storage)\/v1\//.test(pathname),
  handler: new NetworkOnly(),
};

/**
 * C18/auditoría — `skipWaiting: true` activaba el service worker nuevo de
 * inmediato, en medio de la sesión: la próxima navegación (o incluso un
 * fetch en curso) podía servirse con JS de una versión y CSS/chunks de
 * otra ("chunk load error" clásico de PWA post-deploy), sin que el
 * usuario supiera que la app cambió debajo suyo. Ahora el SW nuevo queda
 * "esperando" hasta que `ServiceWorkerRegister` (cliente) confirma con un
 * toast — recién ahí este `message` listener de abajo lo activa.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: false,
  navigationPreload: true,
  runtimeCaching: [
    API_NETWORK_ONLY,
    SUPABASE_NETWORK_ONLY,
    NAVIGATION_PREFETCH_STALE_WHILE_REVALIDATE,
    NAVIGATION_RSC_NETWORK_FIRST_WITH_TIMEOUT,
    NAVIGATION_HTML_NETWORK_FIRST_WITH_TIMEOUT,
    ...defaultCache,
  ],
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

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

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
