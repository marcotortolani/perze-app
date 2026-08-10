import { test, expect } from "@playwright/test";

/**
 * Camino crítico del Bloque A tal como quedó tras sumar preferencias del
 * usuario e invertir el remate:
 * A2 (Google, camino principal) → A4a (nombre) → A4 (país+moneda) → A4b
 * (idioma/formato) → A5 (uso) → A6 (cuenta) → A11 (éxito, primer ingreso)
 * → C1 (ingreso) → primer gasto → A10 (instalar). A7 (saldo inicial) se
 * eliminó del flujo — ver CLAUDE.md § "Onboarding: preferencias del
 * usuario y A7 eliminada".
 * Presupuesto del doc: 35s p50 / 48s p90 contra un objetivo humano de 90s;
 * un run headless no tiene el mismo tiempo de reacción que una persona,
 * así que el test cronometra y afirma contra el techo de 90s, no el p50/p90.
 */
test("signup → primer ingreso → primer gasto en menos de 90s", async ({ page }) => {
  const start = Date.now();

  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Continuar con Google" }).click();

  await page.waitForURL("/onboarding/profile");
  await page.getByLabel("Tu nombre").fill("Valentina");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.waitForURL("/onboarding/country");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.waitForURL("/onboarding/format");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.waitForURL("/onboarding/usage");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.waitForURL("/onboarding/account");
  await page.getByRole("button", { name: "Efectivo" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();

  // La cuenta arranca en 0 — A11 sugiere el primer ingreso, no un gasto.
  await page.waitForURL("/onboarding/success");
  await page.getByRole("button", { name: "Cargar mi primer ingreso" }).click();

  await page.waitForURL("/add");
  await page.getByRole("button", { name: "5", exact: true }).click();
  await page.getByRole("button", { name: "0", exact: true }).click();
  await page.getByRole("button", { name: "0", exact: true }).click();
  await page.getByRole("button", { name: "Sueldo" }).click();
  await expect(page.getByText("Movimiento guardado")).toBeVisible();

  // El ingreso ya se cargó — ahora la pantalla que enseña el primer gasto.
  await page.waitForURL("/onboarding/first-expense");
  await page.getByRole("button", { name: "Cargar mi primer gasto" }).click();

  await page.waitForURL("/add");
  await page.getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("button", { name: "0", exact: true }).click();
  await page.getByRole("button", { name: "0", exact: true }).click();
  await page.getByRole("button", { name: "Supermercado" }).click();

  await expect(page.getByText("Movimiento guardado")).toBeVisible();
  await page.waitForURL("/onboarding/complete");

  const elapsedMs = Date.now() - start;
  console.log(`[cronómetro] signup → primer ingreso → primer gasto: ${elapsedMs}ms`);
  expect(elapsedMs).toBeLessThan(90_000);
});

/**
 * La máquina de estados del primer movimiento (`src/lib/onboarding/
 * first-tx-machine.ts`) existe puntualmente para esto: cancelar sin
 * guardar durante el paso del ingreso NUNCA debe avanzar a "Cargá tu
 * primer gasto" — eso engañaría al usuario haciéndole creer que ya cargó
 * algo. Cerrar con ✕ tiene que aterrizar en home, como cualquier otra
 * cancelación de `/add`.
 */
test("cancelar la captura del primer ingreso no avanza a la pantalla del primer gasto", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Continuar con Google" }).click();

  await page.waitForURL("/onboarding/profile");
  await page.getByLabel("Tu nombre").fill("Valentina");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.waitForURL("/onboarding/country");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.waitForURL("/onboarding/format");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.waitForURL("/onboarding/usage");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.waitForURL("/onboarding/account");
  await page.getByRole("button", { name: "Efectivo" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.waitForURL("/onboarding/success");
  await page.getByRole("button", { name: "Cargar mi primer ingreso" }).click();

  await page.waitForURL("/add");
  await page.getByRole("button", { name: "Cerrar" }).click();

  await page.waitForURL("/");
  await expect(page).not.toHaveURL("/onboarding/first-expense");
});
