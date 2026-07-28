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
    viewTransition: true,
    turbopackFileSystemCacheForDev: true,
  },
};

export default withSerwist(withNextIntl(nextConfig));
