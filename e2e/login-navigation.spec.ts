import { test, expect } from "@playwright/test";

/**
 * C7 — solución de transición (`docs/mejora-auth-oauth-y-email.md` § 0.1).
 * Un login con credenciales reales de punta a punta necesita un usuario ya
 * registrado contra el proyecto remoto de Supabase (no hay `supabase start`
 * local en esta máquina — `CLAUDE.md`), así que queda fuera de este spec.
 * Lo que sí es reproducible sin depender del backend es la navegación entre
 * las tres pantallas nuevas y sus guardas de formulario.
 */
test("login: navegación a olvidé mi contraseña y a crear cuenta", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByPlaceholder("tu@email.com")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeDisabled();

  await page.getByRole("button", { name: "Olvidé mi contraseña" }).click();
  await page.waitForURL("/forgot-password");
  await expect(page.getByRole("button", { name: "Enviar link" })).toBeDisabled();

  await page.goBack();
  await page.waitForURL("/login");
  await page.getByRole("button", { name: "Crear una cuenta" }).click();
  await page.waitForURL("/onboarding");
});

test("forgot-password: el botón se habilita con un email válido", async ({ page }) => {
  await page.goto("/forgot-password");
  const submit = page.getByRole("button", { name: "Enviar link" });
  await expect(submit).toBeDisabled();

  await page.getByPlaceholder("tu@email.com").fill("alguien@ejemplo.com");
  await expect(submit).toBeEnabled();
});
