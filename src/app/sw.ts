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
/**
 * Ninguna navegación redirigida se guarda. Serwist cachea cualquier
 * respuesta 200 (`cacheOkAndOpaquePlugin`), y una redirección seguida ES
 * un 200: pedir `/` sin sesión devuelve, después de seguir el 307 del
 * proxy, el HTML de `/login` con status 200 — que queda guardado **bajo la
 * clave `/`**. Después, ya con sesión, alcanza con que la red tarde más
 * que `networkTimeoutSeconds` para que el service worker sirva ese
 * `/login` cacheado y devuelva al usuario a la pantalla de acceso, con los
 * campos vacíos y sin ningún error que explique nada.
 *
 * Guardar una respuesta cuya URL final no es la pedida está mal aunque no
 * haya sesión de por medio: la clave del cache deja de describir lo que
 * hay adentro.
 *
 * Ojo con un detalle de Serwist: el filtro por defecto (200 u opaca) solo
 * se agrega si NINGÚN plugin declara `cacheWillUpdate`, así que este lo
 * reemplaza y tiene que repetir esa condición además de la suya.
 */
const DISCARD_REDIRECTS = {
  cacheWillUpdate: async ({ response }: { response: Response }) => {
    if (response.redirected || response.type === "opaqueredirect") return null;
    return response.status === 200 || response.status === 0 ? response : null;
  },
};

const NAVIGATION_PREFETCH_STALE_WHILE_REVALIDATE: RuntimeCaching = {
  matcher: ({ request, url: { pathname }, sameOrigin }) =>
    request.headers.get("RSC") === "1" && request.headers.get("Next-Router-Prefetch") === "1" && sameOrigin && !pathname.startsWith("/api/"),
  handler: new StaleWhileRevalidate({ cacheName: "pages-rsc-prefetch", plugins: [DISCARD_REDIRECTS] }),
};

const NAVIGATION_RSC_NETWORK_FIRST_WITH_TIMEOUT: RuntimeCaching = {
  matcher: ({ request, url: { pathname }, sameOrigin }) => request.headers.get("RSC") === "1" && sameOrigin && !pathname.startsWith("/api/"),
  handler: new NetworkFirst({ cacheName: "pages-rsc", networkTimeoutSeconds: 3, plugins: [DISCARD_REDIRECTS] }),
};

/**
 * D78 — el matcher original comparaba `request.headers.get("Content-Type")`,
 * que es un header de RESPUESTA: una navegación GET normal del navegador
 * nunca lo manda en la request, así que esta regla jamás matcheaba nada y
 * toda navegación de documento cayó siempre en el catch-all `others` de
 * `defaultCache` (`NetworkFirst` SIN `networkTimeoutSeconds`) — el mismo
 * problema de "espera a la red sin límite" que este archivo ya arregló para
 * RSC (líneas de arriba), pero nunca aplicado al documento. `request.destination
 * === "document"` es el chequeo correcto — mismo que ya usa el `matcher` del
 * fallback de `/offline` más abajo.
 */
const PAGES_HTML_STRATEGY = new NetworkFirst({ cacheName: "pages", networkTimeoutSeconds: 3, plugins: [DISCARD_REDIRECTS] });

const NAVIGATION_HTML_NETWORK_FIRST_WITH_TIMEOUT: RuntimeCaching = {
  matcher: ({ request, url: { pathname }, sameOrigin }) => request.destination === "document" && sameOrigin && !pathname.startsWith("/api/"),
  handler: PAGES_HTML_STRATEGY,
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
  /**
   * El `share_target` del manifest entra por `/add?title=…&note=…&url=…`, y
   * la entrada precacheada es `/add` a secas: sin esto, `PrecacheRoute` no
   * matchea (su default solo ignora `utm_*` y `fbclid`), la navegación cae
   * al runtime, offline no hay nada guardado bajo esa URL con query y
   * termina en el fallback `/offline` — compartir algo a PERZE sin
   * conexión no cargaría nada.
   *
   * Los dos primeros hay que repetirlos: pasar la opción REEMPLAZA el
   * default, no lo extiende. Los otros son los del `share_target` de
   * `src/app/manifest.ts` más los `prefill*` que lee `CaptureFlow`. **Este
   * array y el `share_target` del manifest se mueven juntos**: un
   * parámetro nuevo allá que no aparezca acá vuelve a romper el caso
   * offline, y en silencio.
   *
   * No afecta a la app: solo cambia cómo `PrecacheRoute` genera candidatos
   * para BUSCAR en el precache. La URL real no se toca, así que
   * `useSearchParams()` sigue leyendo los mismos valores.
   */
  precacheOptions: {
    ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^title$/, /^note$/, /^text$/, /^url$/, /^prefill/],
  },
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

/**
 * Warm-up de `/` — el `start_url` del manifest, o sea lo que se abre al
 * tocar el ícono de la PWA.
 *
 * `/` no puede ir en `additionalPrecacheEntries` (ver el comentario largo
 * en `src/app/serwist/[path]/route.ts`): el precache se instala sin sesión
 * y guardaría la redirección a `/start` bajo la clave `/`, cache-first,
 * hasta el próximo deploy. Este camino no tiene ese problema porque lo
 * dispara el cliente **cuando ya hay sesión** (`pages-cache-warmup.tsx`),
 * así que lo que se guarda es el home de verdad.
 *
 * Se hace acá adentro y no en el cliente por dos razones: el nombre real
 * del cache lleva el prefijo y el sufijo de Serwist (`serwist-pages-<scope>`),
 * que desde la página habría que adivinar; y reusando la misma instancia
 * de estrategia se hereda `DISCARD_REDIRECTS` — si la respuesta viniera
 * redirigida igual, no se guarda, sin repetir esa regla en dos lados.
 */
async function warmHomeCache(event: ExtendableMessageEvent): Promise<void> {
  const request = new Request("/", { credentials: "same-origin", headers: { Accept: "text/html" } });
  try {
    await PAGES_HTML_STRATEGY.handle({ event, request, url: new URL(request.url) });
  } catch {
    // Best-effort puro: si no hay red o el servidor falla, la app sigue
    // igual que hoy. Nada de esto puede romper una pestaña abierta.
  }
}

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data === "WARM_HOME") event.waitUntil(warmHomeCache(event));
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
