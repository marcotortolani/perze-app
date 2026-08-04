import { test, expect } from "@playwright/test";
import { seedDemoHousehold } from "./helpers";

// El gesto se dirige con `page.mouse`: bajo emulación táctil (el proyecto
// `mobile-chromium` trae `hasTouch: true`) Chromium no traduce esos eventos
// de mouse en los `pointerdown/move/up` que `@use-gesture` escucha. Se
// desactiva la emulación táctil solo para este archivo.
test.use({ hasTouch: false });

/**
 * D1/home — el swipe izquierda de "Últimos movimientos" ya no borra en el
 * acto: pasa a una confirmación destructiva en la propia fila, y recién al
 * tocar "Borrar" se ejecuta el `softDelete` con el toast de "Deshacer" de
 * siempre. Cubre el camino feliz completo: swipe → confirmar → deshacer.
 *
 * La sección muestra un `.slice(0, 5)` fijo (`src/app/(app)/page.tsx`):
 * borrar el primero hace que el 6to movimiento sembrado ocupe el último
 * lugar — el conteo de filas NO baja. Por eso se compara el listado
 * completo de textos en vez de contar filas.
 */
test("home: swipe izquierda confirma antes de borrar, y Deshacer restaura el movimiento", async ({ page }) => {
  await seedDemoHousehold(page);
  await page.goto("/");

  const section = page.getByText("Últimos movimientos").locator("..").locator("..");
  // El primer `button` del grupo es "Ver todos" (header del SectionGroup),
  // no una fila — las filas de movimiento arrancan en el índice 1.
  const rows = section.getByRole("button").filter({ hasNotText: "Ver todos" });
  const firstRow = rows.first();
  await expect(firstRow).toBeVisible();
  await firstRow.scrollIntoViewIfNeeded();
  const beforeTexts = await rows.allTextContents();

  const box = await firstRow.boundingBox();
  if (!box) throw new Error("no bounding box for first row");

  // Swipe izquierda pasado el COMMIT_THRESHOLD (160px) — mouse.move real
  // en varios pasos, no un solo salto: @use-gesture necesita más de un
  // evento de puntero para reconocer el drag.
  const startX = box.x + box.width - 20;
  const y = box.y + box.height / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(startX - (200 * i) / 6, y);
  }
  await page.mouse.up();

  await expect(page.getByText("¿Borrar movimiento?")).toBeVisible();

  await page.getByRole("button", { name: "Borrar" }).click();

  await expect(page.getByText("Movimiento borrado")).toBeVisible();
  // El primero borrado, el resto corrido una posición, y un 6to que antes
  // no se veía entra al final.
  await expect(rows).toHaveCount(beforeTexts.length);
  const afterDeleteTexts = await rows.allTextContents();
  expect(afterDeleteTexts.slice(0, beforeTexts.length - 1)).toEqual(beforeTexts.slice(1));
  expect(afterDeleteTexts[beforeTexts.length - 1]).not.toEqual(beforeTexts[beforeTexts.length - 1]);

  await page.getByRole("button", { name: "Deshacer" }).click();

  await expect(page.getByText("Movimiento borrado")).not.toBeVisible();
  await expect(rows).toHaveCount(beforeTexts.length);
  await expect.poll(() => rows.allTextContents()).toEqual(beforeTexts);
});
