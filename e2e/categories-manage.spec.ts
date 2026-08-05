import { test, expect } from "@playwright/test";
import { seedDemoHousehold } from "./helpers";

/**
 * K5 — Ajustes → Categorías dejó de ser solo un selector de plantilla:
 * ahora se puede crear una categoría, agregarle una subcategoría, editar
 * (incluso una de plantilla — copy-on-write) y archivar con Deshacer.
 * Camino feliz encadenado.
 *
 * El fondo de la pantalla (con su propio botón "Guardar" para la
 * plantilla) queda montado detrás del Sheet — cualquier locator de
 * "Guardar" adentro del sheet tiene que ir por `dialog`, si no Playwright
 * ve dos botones con ese nombre y tira strict-mode violation.
 */
test("categorías: crear, agregar subcategoría, editar una de plantilla, y archivar con Deshacer", async ({ page }) => {
  await seedDemoHousehold(page);
  await page.goto("/more/categories");

  const dialog = page.getByRole("dialog");

  // Crear una categoría raíz — el picker de íconos se busca por nombre
  // traducido, no por la clave cruda del ícono.
  await page.getByRole("button", { name: "Nueva categoría" }).click();
  await expect(page.getByRole("heading", { name: "Nueva categoría" })).toBeVisible();
  await dialog.getByLabel("Nombre").fill("Mascotas E2E");
  await dialog.getByPlaceholder("Buscar ícono…").fill("mascota");
  await dialog.getByRole("button", { name: "Mascota", exact: true }).click();
  await dialog.getByRole("button", { name: "Guardar" }).click();

  const newRoot = page.getByRole("button", { name: "Mascotas E2E" });
  await expect(newRoot).toBeVisible();

  // Agregar una subcategoría desde adentro del sheet de la raíz recién creada.
  await newRoot.click();
  await dialog.getByRole("button", { name: "Agregar subcategoría" }).click();
  await expect(page.getByRole("heading", { name: 'Nueva subcategoría en "Mascotas E2E"' })).toBeVisible();
  await dialog.getByLabel("Nombre").fill("Perros E2E");
  await dialog.getByRole("button", { name: "Guardar" }).click();

  await expect(page.getByRole("button", { name: "Mascotas E2E" })).toContainText("1 subcategorías");
  await expect(page.getByRole("button", { name: "Perros E2E" })).toBeVisible();

  // Editar una categoría de plantilla (copy-on-write) — sobrevive a un reload.
  await page.getByRole("button", { name: "Salud" }).click();
  await dialog.getByLabel("Nombre").fill("Médicos E2E");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("button", { name: "Médicos E2E" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Médicos E2E" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Salud" })).toHaveCount(0);

  // Archivar la raíz creada — cascada sobre su subcategoría, con Deshacer.
  // El botón se llamaba "Borrar categoría" y no borraba nada: llamaba a
  // `archiveWithChildren()`. Ahora dice lo que hace, y "Borrar categoría"
  // existe aparte, para el borrado definitivo.
  await page.getByRole("button", { name: "Mascotas E2E" }).click();
  await dialog.getByRole("button", { name: "Archivar categoría" }).click();
  await expect(page.getByText('"Mascotas E2E" y sus 1 subcategorías, archivadas')).toBeVisible();

  // Archivar ya no la hace DESAPARECER de la pantalla: la baja a la sección
  // "Archivadas", que es lo que hace que sea reversible sin depender de que
  // el toast siga vivo. Sigue una sola por nombre, así que estar adentro de
  // esa sección prueba que salió del árbol activo.
  const archivadas = page.getByText("Archivadas", { exact: true }).locator("..");
  await expect(page.getByRole("button", { name: "Mascotas E2E" })).toHaveCount(1);
  await expect(archivadas.getByRole("button", { name: "Mascotas E2E" })).toBeVisible();
  await expect(archivadas.getByRole("button", { name: "Perros E2E" })).toBeVisible();

  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByRole("button", { name: "Mascotas E2E" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Perros E2E" })).toBeVisible();
  // Y vuelven al árbol activo: la sección de archivadas queda vacía y no se
  // renderiza.
  await expect(page.getByText("Archivadas", { exact: true })).toHaveCount(0);
});
