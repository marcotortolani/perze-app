import { test, expect } from "@playwright/test";
import { seedDemoHousehold, enableModule } from "./helpers";

/**
 * Reportado por el usuario: comprar/vender un instrumento movía el saldo de
 * la cuenta pero no aparecía en Egresos/Ingresos del período — la tira
 * mostraba "+US$ 0,00" con la fila de la compra ya listada abajo. La
 * migración `20260808000000_investing_transactions.sql` había decidido
 * excluir `investing` de esos agregados, decisión revertida: comprar
 * acciones es plata real que sale de la misma cuenta con la que se
 * controla el gasto. Este test cubre el camino feliz completo: cargar una
 * compra, verla contar en Egresos, aislarla con el filtro nuevo, y
 * confirmar que NO contaminó el presupuesto (sigue siendo solo consumo).
 *
 * `skip`, mismo motivo que los dos tests de inversiones en
 * `navigation-replace.spec.ts`: `portfolios-repo.ts`, `trades-repo.ts` e
 * `instruments-repo.ts` pegan directo a Supabase, sin Dexie ni outbox. En
 * modo demo (sin sesión real) `/investments` y sus formularios quedan en
 * skeleton para siempre — confirmado corriendo este test contra el dev
 * server: se cuelga esperando "Crear portfolio", que nunca sale del
 * esqueleto. No es un bug de esta feature, es la misma limitación de
 * infraestructura que ya tiene skip en otro lado. Sacar el skip cuando
 * inversiones tenga offline/demo (junto con los otros dos).
 */
test.skip("comprar un instrumento cuenta en Egresos del período y se puede filtrar, sin tocar presupuestos", async ({ page }) => {
  await seedDemoHousehold(page);
  await enableModule(page, "Inversiones");

  // Crear el portfolio por defecto — EmptyState de I1 con cero portfolios.
  await page.goto("/investments");
  await page.getByRole("button", { name: "Crear portfolio" }).click();
  await page.waitForURL(/\/investments\/.+/);
  const portfolioUrl = page.url();
  const portfolioId = portfolioUrl.split("/investments/")[1]!.split(/[/?]/)[0]!;

  await page.goto(`/investments/${portfolioId}/trades/new`);

  // Elegir instrumento — ninguno existe todavía, se crea a mano desde el picker.
  await page.getByText("Elegir instrumento").click();
  await page.getByText("Agregar instrumento").click();
  await page.waitForURL(/\/instruments\/new/);
  await page.getByText("¿No lo encontrás? Crear a mano").click();
  await page.getByLabel("Símbolo").fill("ACME");
  await page.getByLabel("Nombre").fill("Acme Corp");
  await page.getByText("Clase de activo").click();
  await page.getByText("Acciones", { exact: true }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.waitForURL(/\/trades\/new/);

  // El instrumento recién creado no queda auto-seleccionado (comportamiento
  // documentado): hay que volver a abrir el picker y elegirlo.
  await page.getByText("Elegir instrumento").click();
  await page.getByText("ACME").click();

  // Cuenta de liquidación — cualquiera de las cuentas del seed sirve, ninguna es tarjeta.
  await page.getByText("Cuenta de liquidación").click();
  await page.getByText("Itaú Caja de Ahorro").click();

  // Cantidad: 10
  await page.getByText("Cantidad", { exact: true }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "0", exact: true }).click();
  await page.getByRole("button", { name: "Listo" }).click();

  // Precio unitario: 50
  await page.getByText(/Precio unitario/).click();
  await page.getByRole("button", { name: "5", exact: true }).click();
  await page.getByRole("button", { name: "0", exact: true }).click();
  await page.getByRole("button", { name: "Listo" }).click();

  await page.getByRole("button", { name: "Guardar" }).click();
  await page.waitForURL(`/investments/${portfolioId}`);

  // La fila aparece en /transactions con el símbolo del instrumento.
  await page.goto("/transactions");
  await expect(page.getByText("ACME")).toBeVisible();

  // La tira del período dice "Egresos" (no "Gastos") y su cifra no es 0 —
  // el síntoma reportado era exactamente "+US$ 0,00" con la fila visible.
  const egresosCaption = page.getByText("Egresos", { exact: true });
  await expect(egresosCaption).toBeVisible();
  const egresosText = await egresosCaption.locator("..").textContent();
  expect(egresosText).toMatch(/[1-9]/);

  // El filtro "Inversiones" aísla la fila.
  await page.getByRole("button", { name: "Filtros" }).click();
  await page.getByText("Inversión", { exact: true }).click();
  await page.getByRole("button", { name: /Ver \d+ resultado/ }).click();
  await expect(page.getByText("ACME")).toBeVisible();
  await expect(page.getByText("Supermercado")).not.toBeVisible();

  // El presupuesto del período no se mueve: la compra no es consumo.
  await page.goto("/analytics/categories");
  await expect(page.getByText("ACME")).not.toBeVisible();
});
