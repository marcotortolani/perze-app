import { test, expect } from "@playwright/test";
import { seedDemoHousehold } from "./helpers";

/**
 * Bloque C, camino feliz: monto + una categoría frecuente guarda el gasto
 * sin pasar por la grilla de categorías (C2) ni un botón "Guardar" explícito
 * — `docs/perze-plan-redesign-first-5-blocks.md` § Fase 5 fija 2,90 s / 2
 * decisiones como presupuesto. Acá cronometramos el camino real, sin
 * afirmar el número humano del doc (un test headless no tiene el mismo
 * tiempo de reacción), pero sí el techo que atraparía una regresión.
 */
test("gasto en 2 taps: monto + categoría frecuente guarda sin pasos extra", async ({ page }) => {
  await seedDemoHousehold(page);

  await page.goto("/add");
  await expect(page.getByRole("button", { name: "Supermercado" })).toBeVisible();

  const start = Date.now();

  // Tap 1 (compuesto): el monto se escribe en el keypad.
  await page.getByRole("button", { name: "5", exact: true }).click();
  await page.getByRole("button", { name: "0", exact: true }).click();
  await page.getByRole("button", { name: "0", exact: true }).click();

  // Tap 2: la categoría frecuente guarda directo — nunca se toca "Siguiente"/"Guardar".
  await page.getByRole("button", { name: "Supermercado" }).click();

  await expect(page.getByText("Movimiento guardado")).toBeVisible();
  const elapsedMs = Date.now() - start;

  await page.waitForURL("/");

  console.log(`[cronómetro] gasto en 2 taps: ${elapsedMs}ms`);
  expect(elapsedMs).toBeLessThan(5000);
});
