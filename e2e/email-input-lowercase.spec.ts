import { expect, test } from "@playwright/test";

/**
 * Los campos de email de las pantallas públicas (A2, login, recuperar
 * contraseña) pasan por `useEmailField`: minúscula forzada y error que
 * propone la corrección al salir del campo. `/forgot-password` es la más
 * simple de las tres y no necesita sesión.
 */
test("el email se normaliza a minúscula y el error propone la corrección", async ({ page }) => {
  await page.goto("/forgot-password");
  const field = page.getByRole("textbox").first();

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
