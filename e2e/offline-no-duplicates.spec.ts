import { test, expect, type Page } from "@playwright/test";
import { seedDemoHousehold } from "./helpers";

async function saveOne(page: Page, marker: string): Promise<void> {
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "0", exact: true }).click();
  await page.getByRole("button", { name: "0", exact: true }).click();

  await page.getByRole("button", { name: "Detalles" }).click();
  await page.getByLabel("Nota").fill(marker);
  // Sheet sin botón de cierre propio (`Sheet.tsx`): se cierra tocando el
  // scrim, visible por encima de la sección (height fija de 480px sobre un
  // viewport de 844px de alto — el toque cae fuera de la hoja).
  await page.mouse.click(195, 50);

  await page.getByRole("button", { name: "Supermercado" }).click();
  const toast = page.getByText(/^Movimiento guardado$|^Guardado sin tipo de cambio/);
  await expect(toast).toBeVisible();
  // El toast (top-center, 5s) tapa el scrim del sheet de la próxima
  // iteración si sigue en pantalla — se espera a que desaparezca antes de
  // seguir en modo ráfaga.
  await expect(toast).toBeHidden({ timeout: 6000 });
}

/**
 * Local-first (`docs/perze-plan-redesign-first-5-blocks.md` § Decisiones):
 * el guardado nunca depende de la red. Tres gastos con el contexto offline
 * tienen que persistir igual, y al reconectar no puede aparecer ningún
 * duplicado — no hay hoy un worker que drene `lib/offline/outbox.ts`
 * (deliberado, ver comentario ahí), así que esto es la variante correcta
 * del test: nada re-envía nada al volver la red.
 *
 * Se abre `/add` una sola vez, con red, y modo ráfaga (C8) encadena los
 * tres gastos sin navegar de nuevo: en dev, sin service worker (solo se
 * genera en el build de producción, ver `src/app/sw.ts`), una segunda
 * navegación a una ruta interceptada offline fallaría por falta de RSC
 * payload — un problema de la app en dev, no del invariante que este test
 * verifica.
 */
test("3 gastos con la red cortada y reconexión sin duplicados", async ({ page, context }) => {
  await seedDemoHousehold(page);

  await page.getByRole("button", { name: "Agregar" }).click();
  await page.getByRole("button", { name: "Detalles" }).click();
  await page.getByRole("switch").click();
  await page.mouse.click(195, 50);

  const marker = `e2e-offline-${test.info().testId}`;

  await context.setOffline(true);
  await saveOne(page, marker);
  await saveOne(page, marker);
  await saveOne(page, marker);

  await context.setOffline(false);

  await page.goto("/search");
  await page.getByPlaceholder("Buscar movimientos, cuentas, categorías…").fill(marker);

  await expect(page.getByText(`Movimientos · 3`, { exact: true })).toBeVisible();
});
