import { test, expect } from "@playwright/test";
import { seedDemoHousehold, enableModule } from "./helpers";

/**
 * Reportado por el usuario: la primera carga de una posición de inversión
 * (lo que ya tenías antes de usar la app) obligaba a comprar de verdad —
 * `createSettlementTransaction` generaba SIEMPRE una transacción de
 * liquidación, así que cargar "10 SPCX que ya tenía" inflaba plata
 * ficticia en una cuenta y después esa compra aparecía como un movimiento
 * real del mes en Egresos, contaminando el período. El fix (I3): un
 * tercer kind, `transfer_in` ("Posición inicial"), que suma a la posición
 * (`computePositions`) sin tocar ninguna cuenta (`tradeMovesCash`).
 *
 * `skip`, mismo motivo que `investing-in-period-totals.spec.ts`:
 * `trades-repo.ts`/`instruments-repo.ts` pegan directo a Supabase sin
 * Dexie/outbox, así que en modo demo `/investments` queda en skeleton
 * para siempre. Sacar el skip junto con los otros dos cuando inversiones
 * tenga offline/demo.
 */
test.skip("cargar una posición inicial suma a la posición, sin aparecer en Movimientos ni mover ninguna cuenta", async ({ page }) => {
  await seedDemoHousehold(page);
  await enableModule(page, "Inversiones");

  await page.goto("/investments");
  await page.getByRole("button", { name: "Crear portfolio" }).click();
  await page.waitForURL(/\/investments\/.+/);
  const portfolioId = page.url().split("/investments/")[1]!.split(/[/?]/)[0]!;

  await page.goto(`/investments/${portfolioId}/trades/new`);

  await page.getByText("Elegir instrumento").click();
  await page.getByText("Agregar instrumento").click();
  await page.waitForURL(/\/instruments\/new/);
  await page.getByText("¿No lo encontrás? Crear a mano").click();
  await page.getByLabel("Símbolo").fill("SPCX");
  await page.getByLabel("Nombre").fill("Space Exploration Technologies Corp");
  await page.getByText("Clase de activo").click();
  await page.getByText("Acciones", { exact: true }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.waitForURL(/\/trades\/new/);

  await page.getByText("Elegir instrumento").click();
  await page.getByText("SPCX").click();

  // "Posición inicial" — no se elige cuenta de liquidación, no la pide.
  await page.getByRole("button", { name: "Posición inicial" }).click();
  await expect(page.getByText("Cuenta de liquidación")).not.toBeVisible();
  await expect(page.getByText(/No mueve ninguna de tus cuentas/)).toBeVisible();

  await page.getByText("Cantidad", { exact: true }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "Listo" }).click();

  await page.getByText(/Precio unitario/).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("button", { name: "8", exact: true }).click();
  await page.getByRole("button", { name: "Listo" }).click();

  const balanceBefore = await page.getByText(/Itaú/).locator("..").textContent();

  await page.getByRole("button", { name: "Guardar" }).click();
  await page.waitForURL(`/investments/${portfolioId}`);

  // Aparece en la posición del portfolio.
  await expect(page.getByText("SPCX")).toBeVisible();

  // No aparece en Movimientos — nunca se creó una transacción.
  await page.goto("/transactions");
  await expect(page.getByText("SPCX")).not.toBeVisible();

  // Ninguna cuenta se movió.
  await page.goto("/accounts");
  const balanceAfter = await page.getByText(/Itaú/).locator("..").textContent();
  expect(balanceAfter).toBe(balanceBefore);
});
