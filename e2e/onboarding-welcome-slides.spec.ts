import { expect, test } from "@playwright/test";

/**
 * A1 — los tres slides del welcome. Camino feliz: se avanza con el botón
 * primario, que recién en el último dice "Empezar" y sale a A2. "Saltear"
 * corta en cualquier slide.
 */
test.describe("A1 · welcome en tres slides", () => {
  test("el botón primario avanza los tres slides y el último sale a A2", async ({ page }) => {
    await page.goto("/onboarding/welcome");

    await expect(page.getByRole("heading", { name: "Cargar un gasto: cinco segundos." })).toBeVisible();
    await expect(page.getByRole("group")).toHaveAttribute("aria-label", "1 / 3");

    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByRole("heading", { name: "Varias monedas, un solo número." })).toBeVisible();
    await expect(page.getByRole("group")).toHaveAttribute("aria-label", "2 / 3");

    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByRole("heading", { name: "Crece con vos, no antes." })).toBeVisible();
    await expect(page.getByRole("group")).toHaveAttribute("aria-label", "3 / 3");

    // En el último ya no hay "Siguiente": el primario es la salida.
    await expect(page.getByRole("button", { name: "Siguiente" })).toHaveCount(0);
    await page.getByRole("button", { name: "Empezar" }).click();
    await page.waitForURL(/\/onboarding$/);
  });

  test("saltear sale a A2 desde el primer slide y no vuelve a aparecer", async ({ page }) => {
    await page.goto("/onboarding/welcome");
    await page.getByRole("button", { name: "Saltear" }).click();
    await page.waitForURL(/\/onboarding$/);

    // La marca vive en localStorage: volver a `/onboarding` ya no redirige.
    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/onboarding$/);
  });
});
