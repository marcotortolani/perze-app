import { expect, test } from "@playwright/test";

/**
 * `/join` — el otro lado de J3. Sin sesión no se puede canjear
 * (`accept_invite` exige `auth.uid()`), así que la pantalla guarda el
 * código y manda a registrarse.
 */
test.describe("/join · canjear una invitación", () => {
  test("el link de invitación prellena el código", async ({ page }) => {
    await page.goto("/join?invite=AB2CD3EFGHJ");
    await expect(page.getByRole("textbox").first()).toHaveValue("AB2CD3EFGHJ");
  });

  test("limpia lo pegado desde un chat: espacios, minúsculas y basura", async ({ page }) => {
    await page.goto("/join");
    const field = page.getByRole("textbox").first();
    await field.fill(' "ab2 cd3-efghj"\n');
    await expect(field).toHaveValue("AB2CD3EFGHJ");
  });

  test("sin sesión guarda el código y manda al alta", async ({ page }) => {
    await page.goto("/join?invite=AB2CD3EFGHJ");
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await page.waitForURL(/\/onboarding/);
    const stored = await page.evaluate(() => window.localStorage.getItem("perze-pending-invite"));
    expect(stored).toBe("AB2CD3EFGHJ");
  });

  test("desde A2 se llega a /join sin tener el link", async ({ page }) => {
    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");
    const skip = page.getByRole("button", { name: "Saltear" });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await page.getByRole("button", { name: "Tengo un código de invitación" }).click();
    await page.waitForURL(/\/join/);
  });
});
