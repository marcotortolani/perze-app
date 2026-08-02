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
 */
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: "/offline", revision }],
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});
