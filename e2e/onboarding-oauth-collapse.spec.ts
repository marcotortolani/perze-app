import { expect, test } from "@playwright/test";

/**
 * A2 con `NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS=google` (estado de producción
 * objetivo, ver `playwright.config.ts`). `CLAUDE.md` § "Orden de A2": con
 * OAuth registrado el email colapsa bajo "Usar mi email" — no convive
 * siempre visible con los botones de proveedor, que es lo que dibuja el
 * archivo de diseño (gana `CLAUDE.md`, autoridad 1).
 */
test.describe("A2 · colapso del email con Google encendido", () => {
  test("el email arranca colapsado y se expande al tocar 'Usar mi email'", async ({ page }) => {
    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");
    const skip = page.getByRole("button", { name: "Saltear" });
    if (await skip.isVisible().catch(() => false)) await skip.click();

    await expect(page.getByRole("button", { name: "Continuar con Google" })).toBeVisible();
    await expect(page.getByPlaceholder("tu@email.com")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar link de acceso" })).toHaveCount(0);

    await page.getByRole("button", { name: "Usar mi email" }).click();

    const emailInput = page.getByPlaceholder("tu@email.com");
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toBeFocused();
    await expect(page.getByRole("button", { name: "Enviar link de acceso" })).toBeDisabled();
  });

  test("Apple no se dibuja sin estar en la lista de providers", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page.getByRole("button", { name: "Continuar con Apple" })).toHaveCount(0);
  });
});
