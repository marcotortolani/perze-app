import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * `@serwist/next` (el paquete "clásico") compila el service worker con
 * webpack — no corre nada bajo Turbopack, ni en dev ni en `next build`
 * (Turbopack es el bundler por defecto acá, ver `AGENTS.md`), así que con
 * ese paquete el build nunca generaba `public/sw.js` de verdad. `@serwist/
 * turbopack` sirve el worker compilado on-demand desde una route handler
 * (`src/app/serwist/[path]/route.ts`) en vez de un archivo estático — por
 * eso el service worker se registra contra `/serwist/sw.js`, no `/sw.js`
 * (ver `src/components/service-worker-register.tsx`).
 */
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  turbopack: {},
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

export default withSerwist(withNextIntl(nextConfig));
