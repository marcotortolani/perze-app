import { test, expect } from "@playwright/test";
import { seedDemoHousehold } from "./helpers";

/**
 * `needs_fx` (`docs/01-arquitectura-datos.md` § 2.5): un gasto en una cuenta
 * de moneda distinta a la base del household, sin tipo de cambio disponible,
 * tiene que guardarse igual — invariante duro de `save-transaction.ts`
 * ("guardar no puede fallar"). Se fuerza "sin cotización disponible" con el
 * contexto offline: `fx-repo.ts` solo llama a `/api/fx` si `navigator.onLine`,
 * así que sin red y sin nada cacheado el resultado es siempre `pending`.
 */
test("gasto en moneda extranjera sin cotización disponible se guarda con needs_fx", async ({ page, context }) => {
  await seedDemoHousehold(page);

  // Abre la ruta interceptada `(.)add` con red (el fetch del RSC
  // payload de la navegación en sí no tiene por qué fallar); recién offline
  // para el guardado, que es la parte que no puede depender de la red.
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.getByRole("button", { name: "5", exact: true })).toBeVisible();
  await context.setOffline(true);

  await page.getByRole("button", { name: "5", exact: true }).click();
  await page.getByRole("button", { name: "0", exact: true }).click();
  await page.getByRole("button", { name: "0", exact: true }).click();

  // Botón que abre el picker de cuenta — texto dinámico "<cuenta> · <moneda>"
  // (o "Elegir cuenta" si no hay ninguna default todavía). La ruta
  // interceptada no oculta del árbol de accesibilidad la página de atrás
  // (`AccountCarousel` de Inicio también matchea "·"): `.last()` toma el
  // nodo más profundo del DOM, que es el de la modal por encima.
  await page.getByRole("button", { name: /·|Elegir cuenta/ }).last().click();
  await page.getByRole("button", { name: /Ahorros USD/ }).last().click();

  await page.getByRole("button", { name: "Supermercado" }).click();

  await expect(page.getByText("Guardado sin tipo de cambio — se resuelve solo al reconectar.")).toBeVisible();

  await context.setOffline(false);
  await page.waitForURL("/");

  // "Ahorros USD" no tiene movimientos sembrados por el demo (queda fuera de
  // `expenseAccounts` en `lib/seed/demo-household.ts`) — el gasto recién
  // guardado es el único ahí, así que no hace falta desambiguar por fecha.
  await page.goto("/accounts");
  await page.getByRole("button", { name: /Ahorros USD/ }).click();
  await page.getByText("Supermercado").first().click();

  await expect(page.getByText("Sin resolver — needs_fx")).toBeVisible();
});
