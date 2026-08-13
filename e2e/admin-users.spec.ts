import { expect, test } from "@playwright/test";
import { seedDemoHousehold } from "./helpers";

/**
 * `/more/admin/users` — camino feliz del rediseño (búsqueda + filtro por
 * estado + master-detail con `?user=`), corriendo contra el viewport mobile
 * por defecto de este proyecto (`playwright.config.ts`), o sea el detalle
 * abre en `<Modal contained>`, no en el split de desktop.
 *
 * No hay fixture de sesión con `is_app_admin` (`e2e/helpers.ts` no trae
 * una): `seedDemoHousehold` loguea un usuario de demo cualquiera, no el
 * operador real de la instancia. Se interceptan las tres RPC del panel
 * (`admin_list_access_requests`, `admin_set_access_status`, `admin_metrics`)
 * y la consulta de `access_status`/`is_app_admin` propia — así el gating
 * pasa sin depender de qué cuenta corrió el seed, y ~60 usuarios en el
 * fixture ejercitan la virtualización (`VIRTUALIZE_THRESHOLD = 50`).
 */

const COUNTRIES = ["UY", "AR", "BR"];

function buildUsers() {
  const users = [];
  for (let i = 0; i < 60; i++) {
    const pending = i < 3;
    users.push({
      profile_id: `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
      email: `usuario${i}@example.com`,
      display_name: i === 5 ? "Valentina Méndez" : `Usuario ${i}`,
      country: COUNTRIES[i % COUNTRIES.length],
      access_status: pending ? "pending" : i % 7 === 0 ? "rejected" : i % 11 === 0 ? "disabled" : "approved",
      access_requested_at: new Date(2026, 0, 1 + i).toISOString(),
      last_seen_at: i % 4 === 0 ? null : new Date(2026, 6, 1 + (i % 28)).toISOString(),
      is_app_admin: false,
    });
  }
  return users;
}

test("/more/admin/users · búsqueda + filtro por estado + detalle con undo", async ({ page }) => {
  await seedDemoHousehold(page);

  const baseUsers = buildUsers();
  const pendingCount = baseUsers.filter((u) => u.access_status === "pending").length;
  const statusOverrides: Record<string, string> = {};

  await page.route("**/rest/v1/profiles?select=access_status*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_status: "approved", is_app_admin: true }) });
  });

  await page.route("**/rest/v1/rpc/admin_metrics", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ total: baseUsers.length, pending: pendingCount, approved: 0, rejected: 0, disabled: 0, byCountry: {}, byAgeRange: {}, activeToday: 0, active7d: 0, active30d: 0, inactive: 0 }) });
  });

  await page.route("**/rest/v1/rpc/admin_list_access_requests", async (route) => {
    const data = baseUsers.map((u) => ({ ...u, access_status: statusOverrides[u.profile_id] ?? u.access_status }));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });

  await page.route("**/rest/v1/rpc/admin_set_access_status", async (route) => {
    const body = route.request().postDataJSON() as { target_id: string; new_status: string };
    statusOverrides[body.target_id] = body.new_status;
    await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
  });

  await page.goto("/more/admin/users");

  // Banner de pendientes visible con el conteo real.
  await expect(page.getByText(`${pendingCount} solicitudes esperan tu decisión`)).toBeVisible();

  // Tocar el banner filtra a pendientes — la URL lo refleja y el contador baja.
  await page.getByRole("button", { name: "Ver solicitudes" }).click();
  await expect(page).toHaveURL(/status=pending/);
  await expect(page.getByText(`${pendingCount} de ${baseUsers.length} usuarios`)).toBeVisible();

  // Buscar dentro del filtro de pendientes conserva `status=pending` en la URL.
  await page.getByLabel("Buscar por email o nombre").fill("usuario0");
  await expect(page).toHaveURL(/status=pending/);
  await expect(page).toHaveURL(/q=usuario0/);

  // Abrir el primer resultado — la URL suma `user=` sin perder `q`/`status`.
  const targetId = baseUsers[0]!.profile_id;
  await page.getByRole("button", { name: `Ver la ficha de ${baseUsers[0]!.email}` }).click();
  await expect(page).toHaveURL(new RegExp(`user=${targetId}`));
  await expect(page).toHaveURL(/status=pending/);
  await expect(page).toHaveURL(/q=usuario0/);
  await expect(page.getByText(baseUsers[0]!.email, { exact: true }).first()).toBeVisible();

  // Aprobar dispara un toast con Deshacer.
  await page.getByRole("button", { name: "Aprobar" }).click();
  const undoButton = page.getByRole("button", { name: "Deshacer" });
  await expect(undoButton).toBeVisible();

  // Deshacer devuelve el badge a Pendiente.
  await undoButton.click();
  await expect(page.getByText("Pendiente", { exact: true }).first()).toBeVisible();

  // Back del navegador cierra el detalle y conserva los filtros en la URL.
  await page.goBack();
  await expect(page).not.toHaveURL(new RegExp(`user=${targetId}`));
  await expect(page).toHaveURL(/status=pending/);
  await expect(page).toHaveURL(/q=usuario0/);
});
