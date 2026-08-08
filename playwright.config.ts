import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

/**
 * Los tests de PWA corren contra un BUILD DE PRODUCCIÓN, en su propio
 * puerto. No es una preferencia: en desarrollo el service worker no se
 * registra (`src/components/service-worker-register.tsx`) porque Turbopack
 * renombra los chunks en cada arranque y el precache de la sesión anterior
 * termina sirviendo HTML que apunta a archivos que ya no existen. La
 * escotilla `NEXT_PUBLIC_ENABLE_SW_IN_DEV=1` tampoco sirve acá: probaría
 * ese bug de dev, no el comportamiento real.
 */
const PWA_PORT = 3101;
const pwaBaseURL = `http://localhost:${PWA_PORT}`;
// Anclado al nombre de ARCHIVO (`[\\/]` adelante, `$` atrás): Playwright
// matchea contra la ruta absoluta, así que un patrón suelto como
// `/pwa-.*\.spec\.ts/` se cumple por cualquier directorio de la ruta que
// contenga "pwa-" y arrastra toda la suite al proyecto equivocado.
const PWA_TESTS = /[\\/]pwa-[^\\/]*\.spec\.ts$/;

// Google es el estado de producción objetivo (docs/mejora-auth-oauth-y-email.md
// § 2): A2 colapsa el email bajo "Usar mi email" con esto encendido.
// `onboarding-first-expense.spec.ts` ya asumía este botón.
const serverEnv = { ...process.env, NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS: "google" };

/**
 * Mobile-first: viewport 390×844 (mismo que usan los `.dc.html` de
 * referencia de cada bloque, ver docs/perze-plan-redesign-first-5-blocks.md
 * § Verificación). Cada test parte de una cuenta de storage aislada
 * (`storageState` default = ninguno) para no compartir IndexedDB entre tests.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Fija el locale a español: sin cookie `perze_locale`, `src/i18n/
    // request.ts` negocia por `Accept-Language` (ver Fase 0 del plan de
    // i18n) — sin esto, el locale del entorno de CI decidiría el idioma
    // y estos tests (que buscan texto en español) se romperían solos.
    locale: "es-UY",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
      testIgnore: PWA_TESTS,
    },
    {
      name: "mobile-chromium-pwa",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", baseURL: pwaBaseURL },
      testMatch: PWA_TESTS,
    },
  ],
  webServer: [
    {
      command: `next dev --port ${PORT}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: serverEnv,
    },
    {
      // El build entero, así que el timeout no puede ser el de un `dev`.
      command: `next build && next start --port ${PWA_PORT}`,
      url: pwaBaseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 600_000,
      env: serverEnv,
    },
  ],
});
