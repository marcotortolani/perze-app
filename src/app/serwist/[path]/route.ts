import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

// Revisión del build para el manifest — evita que el navegador se quede
// con una copia vieja del precache entre deploys. `git rev-parse` falla en
// un entorno sin `.git` (algunos hosts de build); ahí cae a un UUID random.
const revision = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() || crypto.randomUUID();

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
