import { test, expect } from "@playwright/test";

/**
 * Camino crítico del Bloque A tal como quedó recortado:
 * A2 (Google/Apple, camino principal) → A4 (país) → A5 (uso) → A6 (cuenta)
 * → A11 (éxito) → C1 (primer gasto). A7 (saldo inicial) y A10 (instalar)
 * quedan afuera a propósito — se piden recién después de este gasto.
 * Presupuesto del doc: 35s p50 / 48s p90 contra un objetivo humano de 90s;
 * un run headless no tiene el mismo tiempo de reacción que una persona,
 * así que el test cronometra y afirma contra el techo de 90s, no el p50/p90.
 */
test("signup → primer gasto en menos de 90s", async ({ page }) => {
  const start = Date.now();

  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Continuar con Google" }).click();

  await page.waitForURL("/onboarding/country");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.waitForURL("/onboarding/usage");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.waitForURL("/onboarding/account");
  await page.getByRole("button", { name: "Efectivo" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.waitForURL("/onboarding/success");
  await page.getByRole("button", { name: "Cargar mi primer gasto" }).click();

  await page.waitForURL("/add");
  await page.getByRole("button", { name: "5", exact: true }).click();
  await page.getByRole("button", { name: "0", exact: true }).click();
  await page.getByRole("button", { name: "0", exact: true }).click();
  await page.getByRole("button", { name: "Supermercado" }).click();

  await expect(page.getByText("Movimiento guardado")).toBeVisible();
  const elapsedMs = Date.now() - start;

  console.log(`[cronómetro] signup → primer gasto: ${elapsedMs}ms`);
  expect(elapsedMs).toBeLessThan(90_000);
});
