import { expect, test } from "@playwright/test";

/**
 * `/about` — página pública de marca para la verificación de Google Auth
 * Platform (`docs/mejora-auth-oauth-y-email.md` § 2): tiene que verse sin
 * sesión, sin redirigir a `/onboarding`, y con un CTA real hacia adentro.
 */
test("se ve sin sesión y el CTA lleva a /onboarding", async ({ page }) => {
  await page.goto("/about");

  await expect(page).toHaveURL("/about");
  await expect(page.getByRole("heading", { name: "Cargar un gasto en menos de 5 segundos." })).toBeVisible();
  await expect(page.getByText("Local-first de verdad")).toBeVisible();

  await page.getByRole("link", { name: "Entrar a PERZE" }).click();
  await page.waitForURL(/\/onboarding/);
});
