import { expect, test } from "@playwright/test";
import { seedDemoHousehold } from "./helpers";

/**
 * J3 · camino feliz — invitar con email cargado dispara el mail
 * (`/api/emails/invite`) además de generar el código. El insert real a
 * `household_invites` (Supabase) y el envío en sí se interceptan: no hay
 * fixture de sesión/household remoto para e2e y no corresponde pegarle a
 * Resend de verdad en un test. Lo que se prueba acá es la UI: que con
 * email cargado el envío se dispara solo y el estado se refleja.
 */
test("J3 · con email cargado, generar código dispara el envío", async ({ page }) => {
  await seedDemoHousehold(page);

  await page.route("**/rest/v1/household_invites**", async (route) => {
    const request = route.request();
    const body = request.postDataJSON() as { email: string | null; role: string } | undefined;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "11111111-1111-4111-8111-111111111111",
        household_id: "22222222-2222-4222-8222-222222222222",
        code: "AB2CD3EFGHJ",
        email: body?.email ?? null,
        role: body?.role ?? "member",
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        revoked_at: null,
        accepted_by: null,
      }),
    });
  });

  let sendRequestBody: { inviteId: string; locale: string } | null = null;
  await page.route("**/api/emails/invite", async (route) => {
    sendRequestBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto("/family/invite");
  await page.getByLabel("Email (opcional)").fill("ana@example.com");
  await page.getByRole("button", { name: "Generar código" }).click();

  await expect(page.getByText("AB2CD3EFGHJ", { exact: true })).toBeVisible();
  await expect(page.getByText("Invitación enviada a ana@example.com")).toBeVisible();
  expect(sendRequestBody?.inviteId).toBe("11111111-1111-4111-8111-111111111111");
});
