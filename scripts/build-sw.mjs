// @ts-check
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getManifest } from "@serwist/build";
import * as esbuild from "esbuild";

/**
 * Genera `public/sw.js` DESPUÉS de `next build` — por eso corre como paso
 * encadenado en el script `build` de `package.json` y no como plugin.
 *
 * **Por qué existe este archivo.** Antes el service worker lo servía una
 * route handler (`src/app/serwist/[path]/route.ts`, `@serwist/turbopack`)
 * que lo compilaba on-demand. Esa ruta declaraba `dynamic = "force-static"`
 * para prerenderizarse en el build, pero **`cacheComponents: true` (Next 16)
 * ignora esa directiva**: la ruta quedaba como función serverless y volvía a
 * compilar el worker en cada cold start. En Vercel eso fallaba con 500
 * —`Cannot find module 'next/dist/server/config.js'`— porque
 * `@serwist/turbopack` lo importa con `/* webpackIgnore: true *\/` y el
 * tracer no puede verlo, así que nunca entra al bundle de la función.
 * Consecuencia: **en producción no había service worker en absoluto** — sin
 * precache, sin fallback offline, sin nada. El registro fallaba y el
 * `.catch()` de `service-worker-register.tsx` se lo tragaba en silencio.
 *
 * Sacar `cacheComponents` habría arreglado la ruta, pero se midió el costo:
 * 108 rutas pierden su shell prerenderizado (`◐` → `ƒ`). No se paga eso por
 * un archivo. La salida correcta es la de siempre para un service worker:
 * **es un artefacto estático del build, no una ruta**. Acá no hay nada que
 * compilar en runtime, nada que trazar y nada que dependa del host.
 *
 * El worker sale a `/sw.js` (raíz), así que su scope es `/` sin necesitar el
 * header `Service-Worker-Allowed`.
 */

const CWD = process.cwd();
const DIST_DIR = ".next/";
const SW_SRC = "src/app/sw.ts";
const SW_DEST = "public/sw.js";

/**
 * Revisión de las entradas que no salen de un archivo con hash en el nombre
 * (`/offline`, `/add`): sin esto el navegador se queda con la copia vieja
 * entre deploys. Mismo orden de resolución que tenía la route handler:
 * Vercel lo inyecta solo (sin `.git` en el build), después el repo completo
 * de un self-host, y por último la versión de `package.json` — estable entre
 * cold starts del mismo deploy. Nunca un valor aleatorio: eso haría que el
 * service worker se reinstale solo sin que el código haya cambiado.
 */
function buildRevision() {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromVercel) return fromVercel;

  const fromGit = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim();
  if (fromGit) return fromGit;

  return JSON.parse(fs.readFileSync("package.json", "utf-8")).version;
}

const revision = buildRevision();

/**
 * `.next/static/**` y `public/**`, igual que los globs por defecto de
 * `@serwist/turbopack`. Los chunks de `.next/static` ya llevan hash en el
 * nombre, así que no se les agrega query de cache-busting
 * (`dontCacheBustURLsMatching`).
 */
const { count, size, manifestEntries, warnings } = await getManifest({
  globDirectory: CWD,
  globPatterns: [
    `${DIST_DIR}static/**/*.{js,css,html,ico,apng,png,avif,jpg,jpeg,jfif,pjpeg,pjp,gif,svg,webp,json,webmanifest}`,
    "public/**/*",
  ],
  // El propio worker y su sourcemap viven en `public/` desde el build
  // anterior: sin esto se precachearían a sí mismos, que además de absurdo
  // deja una copia vieja del worker dentro del worker nuevo.
  globIgnores: ["public/sw.js", "public/sw.js.map"],
  dontCacheBustURLsMatching: new RegExp(`^${DIST_DIR}static/`),
  manifestTransforms: [
    (entries) => ({
      manifest: entries.map((entry) => {
        if (entry.url.startsWith(DIST_DIR)) {
          entry.url = `/_next/${entry.url.slice(DIST_DIR.length)}`;
        } else if (entry.url.startsWith("public/")) {
          entry.url = `/${entry.url.slice("public/".length)}`;
        }
        return entry;
      }),
      warnings: [],
    }),
  ],
  /**
   * `/offline` es el fallback de navegación y `/add` es la captura: el
   * atajo de la PWA, el share target y el deep link entran por ahí. Las dos
   * son respuestas de navegación, no archivos, así que no las levanta
   * ningún glob — hay que declararlas.
   *
   * **`/` NO va acá, y no hay que agregarlo.** Sin sesión `proxy.ts` lo
   * redirige a `/start`, y el precache guarda la redirección seguida bajo
   * la clave `/`: la landing se serviría como si fuera el home, cache-first,
   * hasta el próximo deploy. Para eso está el warm-up del cliente
   * (`src/components/pages-cache-warmup.tsx`), que pide `/` ya con sesión.
   * `/add` sí puede estar porque es ruta pública y nunca redirige.
   */
  additionalPrecacheEntries: [
    { url: "/offline", revision },
    { url: "/add", revision },
  ],
});

if (warnings.length > 0) {
  console.warn(`[sw] advertencias del manifest:\n  ${warnings.join("\n  ")}`);
}

const result = await esbuild.build({
  entryPoints: [{ in: SW_SRC, out: "sw" }],
  outdir: path.dirname(SW_DEST),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome91", "edge91", "firefox90", "safari15"],
  minify: true,
  sourcemap: true,
  treeShaking: true,
  // El punto de inyección que `sw.ts` declara como `self.__SW_MANIFEST`.
  define: { "self.__SW_MANIFEST": JSON.stringify(manifestEntries) },
});

if (result.errors.length > 0) {
  console.error("[sw] esbuild falló", result.errors);
  process.exit(1);
}

console.log(`[sw] ${SW_DEST} — ${count} entradas de precache (${(size / 1024).toFixed(2)} KiB), revision ${revision.slice(0, 8)}`);
