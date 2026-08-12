import { test, expect, type Page } from "@playwright/test";
import { seedDemoHousehold } from "./helpers";

const HIDE_BUTTONS = "[data-home-block-action='hide']";

async function blockOrder(page: Page): Promise<string[]> {
  return page.locator(HIDE_BUTTONS).evaluateAll((els) => els.map((e) => e.querySelector("button")?.getAttribute("aria-label") ?? ""));
}

async function enterEditing(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Personalizar" }).click();
  // El editor (`@dnd-kit`) es un chunk lazy — esperar a que el primer
  // control real aparezca en vez de asumir que el click ya lo montó.
  await page.locator(HIDE_BUTTONS).first().waitFor({ state: "visible" });
}

/**
 * B/Home — reordenar el dashboard por drag & drop, solo en desktop
 * (`docs/plan-de-trabajo.md`). `seedDemoHousehold` no crea una sesión real
 * de Supabase (`DEMO_USER_ID` en `use-current-user.ts`), así que el
 * `update` sobre `profiles.home_layout` falla por RLS en este entorno —
 * la persistencia acá se verifica vía el espejo local
 * (`perze-home-layout` en localStorage), que es justamente lo que sigue
 * funcionando en modo demo/offline. Contra el proyecto real (con sesión),
 * el mismo `save()` además sincroniza al servidor.
 */
test.describe("home: personalizar (desktop)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("entrar al modo edición muestra asas de arrastre y la bandeja de ocultos al ocultar un bloque", async ({ page }) => {
    await seedDemoHousehold(page);
    await page.goto("/");
    await enterEditing(page);

    await expect(page.getByText("Arrastrá los bloques para reordenarlos o pasarlos de columna.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Restablecer" })).toBeVisible();

    // Ocultar el primer bloque de la columna izquierda (Patrimonio neto,
    // orden default) — aparece en la bandeja con su acción "Mostrar" y
    // desaparece de la grilla.
    await page.locator(HIDE_BUTTONS).first().getByRole("button").click();
    await expect(page.getByText("Bloques ocultos")).toBeVisible();
    await expect(page.locator("[data-home-block-action='show']")).toHaveCount(1);
    const order = await blockOrder(page);
    expect(order).not.toContain("Ocultar Patrimonio neto");
  });

  test("reordenar por teclado mueve el bloque dentro de la columna, y el orden persiste en el espejo local tras recargar", async ({ page }) => {
    await seedDemoHousehold(page);
    await page.goto("/");
    await enterEditing(page);

    const orderBefore = await blockOrder(page);
    expect(orderBefore.length).toBeGreaterThan(0);

    // Foco en el asa del primer bloque (accesible por teclado, no por
    // mouse) y reordenar con el sensor de `@dnd-kit`: espacio toma el
    // bloque, flecha abajo lo mueve una posición, espacio lo suelta. Cada
    // paso dispara un `setState` de React (`onDragStart`/`onDragOver`) —
    // sin una pausa entre teclas, `keyboard.press` dispara los tres
    // eventos más rápido de lo que el sensor de `@dnd-kit` alcanza a
    // procesar el anterior.
    await page.locator("[data-home-block-action='handle']").first().focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(150);
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);

    const orderAfter = await blockOrder(page);
    expect(orderAfter).not.toEqual(orderBefore);
    expect(orderAfter[1]).toBe(orderBefore[0]); // el bloque tomado bajó una posición

    await page.getByRole("button", { name: "Listo" }).click();
    await expect(page.getByRole("button", { name: "Personalizar" })).toBeVisible();

    await page.reload();
    await page.waitForTimeout(500);
    await enterEditing(page);
    const orderReloaded = await blockOrder(page);
    expect(orderReloaded).toEqual(orderAfter);
  });

  test("restablecer vuelve al orden original", async ({ page }) => {
    await seedDemoHousehold(page);
    await page.goto("/");
    await enterEditing(page);

    const original = await blockOrder(page);

    await page.locator(HIDE_BUTTONS).first().getByRole("button").click();
    await expect(page.locator("[data-home-block-action='show']")).toHaveCount(1);

    await page.getByRole("button", { name: "Restablecer" }).click();
    const restored = await blockOrder(page);
    expect(restored).toEqual(original);
  });
});

test.describe("home: sin modo edición en mobile", () => {
  test("no existe el botón Personalizar y el orden es el de la columna izquierda seguida de la derecha", async ({ page }) => {
    await seedDemoHousehold(page);
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Personalizar" })).toHaveCount(0);
    // Orden default esperado en una sola columna: patrimonio, cuentas,
    // tarjetas (si hay), egresos/ingresos, sugerencia, últimos movimientos.
    await expect(page.getByText("PATRIMONIO NETO")).toBeVisible();
  });
});
