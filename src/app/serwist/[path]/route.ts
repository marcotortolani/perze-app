import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";
import { APP_VERSION } from "@/lib/version";

// Revisión del build para el manifest — evita que el navegador se quede
// con una copia vieja del precache entre deploys. Antes esto caía directo
// a `crypto.randomUUID()` sin `.git` (Docker, Vercel: el build no siempre
// tiene el repo completo) — un revision aleatorio en CADA cold start hace
// que la entrada de precache de `/offline` cambie sola y el SW se
// reinstale sin que el código haya cambiado un bit (Fase 4 del plan de
// fluidez de navegación). Orden: `VERCEL_GIT_COMMIT_SHA` (Vercel lo inyecta
// solo, sin `.git`) → `git rev-parse` (self-host con el repo completo) →
// `APP_VERSION` (`package.json`, bump manual por release — estable entre
// cold starts del mismo deploy aunque no haya ni Vercel ni `.git`) →
// UUID random, último recurso que en la práctica nunca debería alcanzarse.
const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  APP_VERSION ||
  crypto.randomUUID();

/**
 * Sirve el service worker compilado en `/serwist/sw.js` (registrado desde
 * `src/components/service-worker-register.tsx`) — `@serwist/turbopack` lo
 * compila on-demand con esbuild en vez de un archivo estático, que es la
 * única forma que soporta bajo Turbopack (ver comentario en `next.config.ts`).
 *
 * D78 — `/add` (shortcut de la PWA + `share_target`,
 * `src/app/manifest.ts`) va precacheado junto con `/offline`, no solo
 * dejado al runtime cache. El runtime cache
 * (`NAVIGATION_HTML_NETWORK_FIRST_WITH_TIMEOUT` en `sw.ts`) solo guarda una
 * ruta DESPUÉS de una navegación dura exitosa con red — y el único momento
 * en que el navegador pide `/add` como navegación dura (no una selección
 * blanda dentro de la SPA ya abierta, que usa la ruta interceptora del
 * modal) es justo arrancar la PWA desde el ícono/atajo/share target
 * después de un cierre completo. Sin conexión en ESE primer arranque, no
 * hay entrada de cache todavía y Serwist cae al fallback `/offline` — el
 * caso reportado: "cerré la app del todo, sin internet, quiero cargar un
 * gasto". Precachear la respuesta de navegación de antemano rompe esa
 * dependencia de "tuvo que haber navegado ahí antes con red".
 *
 * **`/` NO puede estar acá, aunque sea el `start_url`, y no hay que
 * volver a agregarlo.** El service worker se instala en la primera visita,
 * que es `/start` o `/onboarding`, o sea SIN sesión: el precache pide `/`,
 * `proxy.ts` lo redirige a `/start`, y Serwist guarda esa redirección bajo
 * la clave `/` — su `copyRedirectedCacheableResponsesPlugin` copia las
 * respuestas redirigidas a propósito. A partir de ahí, `PrecacheRoute` (que
 * se registra ANTES que todo `runtimeCaching`) sirve la landing como si
 * fuera el home, cache-first, por encima de la red, hasta el próximo
 * deploy. Tampoco se puede filtrar desde el service worker: si un
 * `cacheWillUpdate` rechaza la respuesta, `_handleInstall` tira
 * `bad-precaching-response` y falla la instalación entera.
 *
 * `/add` sí puede estar porque se hizo pública en `lib/auth/public-paths.ts`
 * (ver ahí las tres razones) — nunca redirige, así que lo que se guarda es
 * lo que se pidió. Para `/` la respuesta es
 * `src/components/pages-cache-warmup.tsx`: el mismo HTML, pero pedido desde
 * el cliente ya con sesión y guardado en el cache de runtime.
 */
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [
    { url: "/offline", revision },
    { url: "/add", revision },
  ],
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});
