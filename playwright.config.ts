import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

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
    },
  ],
  webServer: {
    command: `next dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // Google es el estado de producción objetivo (docs/mejora-auth-oauth-y-email.md
    // § 2): A2 colapsa el email bajo "Usar mi email" con esto encendido.
    // `onboarding-first-expense.spec.ts` ya asumía este botón.
    env: { ...process.env, NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS: "google" },
  },
});
