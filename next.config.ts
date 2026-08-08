import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * El service worker NO se genera desde acá: lo compila `scripts/build-sw.mjs`
 * como paso encadenado del script `build`, y sale a `public/sw.js`.
 *
 * Hubo dos intentos antes. `@serwist/next` (el paquete "clásico") compila con
 * webpack y no corre nada bajo Turbopack, así que nunca generaba el archivo.
 * `@serwist/turbopack` lo servía desde una route handler que lo compilaba
 * on-demand — y ahí está el motivo de que ya no se use: esa ruta se apoyaba
 * en `dynamic = "force-static"` para prerenderizarse, pero **`cacheComponents`
 * (abajo) ignora esa directiva**, así que quedaba como función serverless y en
 * Vercel devolvía 500. El detalle completo está en `scripts/build-sw.mjs`.
 */
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  turbopack: {},
  // Ojo si algún día algo tiene que prerenderizarse con `export const
  // dynamic = "force-static"`: con este flag encendido esa directiva se
  // ignora y la ruta queda dinámica, sin ningún error que lo avise. Ya
  // costó el service worker entero en producción (ver `scripts/build-sw.mjs`).
  cacheComponents: true,
  experimental: {
    // Fase 5 del plan de fluidez de navegación — `@phosphor-icons/react`
    // (barril de íconos), `motion` y `date-fns` se importan por nombre en
    // todo el código; sin esto Turbopack no puede garantizar que solo el
    // ícono/función usada entre al chunk de cada ruta.
    optimizePackageImports: ["@phosphor-icons/react", "motion", "date-fns"],
    turbopackFileSystemCacheForDev: true,
    // `viewTransition` estaba encendido sin un solo consumidor (`ViewTransition`
    // no se importa en ningún lado, sin `view-transition-name` en el CSS) —
    // se apaga acá para no mezclar variables mientras se mide el resto de
    // esta pasada. Es la guinda de la fluidez de navegación, no el problema:
    // evaluar aparte, con los otros cambios ya medidos.
  },
};

export default withNextIntl(nextConfig);
