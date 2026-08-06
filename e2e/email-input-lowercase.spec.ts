import { expect, test } from "@playwright/test";

/**
 * El campo de email de A2 pasa por `useEmailField`: minúscula forzada y
 * error que propone la corrección al salir del campo. `/forgot-password`
 * (que probaba esto antes) se revirtió junto con las contraseñas
 * (`docs/mejora-auth-oauth-y-email.md` § 0.1) — A2 es el único campo de
 * email público que queda. Con Google encendido (`playwright.config.ts`)
 * el email arranca colapsado: hay que expandirlo primero.
 */
test("el email se normaliza a minúscula y el error propone la corrección", async ({ page }) => {
  await page.goto("/onboarding");
  await page.waitForLoadState("networkidle");
  const skip = page.getByRole("button", { name: "Saltear" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.getByRole("button", { name: "Usar mi email" }).click();

  const field = page.getByPlaceholder("tu@email.com");

  await field.fill("ANA.Perez@Gmail.COM");
  await expect(field).toHaveValue("ana.perez@gmail.com");

  // Escrito a medias: el hint aparece al salir del campo, no antes.
  await field.fill("ana");
  await expect(page.getByText(/Falta el @/)).toHaveCount(0);
  await field.blur();
  await expect(page.getByText("Falta el @: probá ana@gmail.com")).toBeVisible();

  // Sin dominio completo, otro mensaje distinto.
  await field.fill("ana@gmail");
  await field.blur();
  await expect(page.getByText("Falta el final del dominio: probá ana@gmail.com")).toBeVisible();
});
