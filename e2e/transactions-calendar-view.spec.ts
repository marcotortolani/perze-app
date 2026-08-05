import { expect, test, type Page } from "@playwright/test";
import { seedDemoHousehold } from "./helpers";

/**
 * D5 — el calendario como VISTA de `/transactions`, no como ruta.
 *
 * Lo que se prueba acá no es "que el calendario se dibuje": es que el alcance
 * viva en la URL y que la lista sea una sola. El refactor cambió tres cosas que
 * un test unitario no puede ver juntas — que elegir un día **filtre la lista
 * que ya está** en vez de abrir otra pantalla, que el alcance **sobreviva** a
 * abrir un movimiento, y que el botón atrás lo devuelva intacto.
 *
 * Corre en el viewport de la config (390×844), o sea el layout de móvil: el
 * calendario va DENTRO del scroller de la lista, arriba de las filas. Es el
 * caso que más importa proteger — el que motivó todo el trabajo fue que en un
 * teléfono chico la lista no se veía.
 */

/** El chip que prende y apaga la vista. */
function calendarChip(page: Page) {
  return page.getByRole("button", { name: "Calendario", exact: true });
}

/**
 * Las celdas del mes se ubican por su `aria-label`, que es la fecha larga y,
 * si ese día tuvo gasto, el monto detrás de un `·`. Eso permite elegir un día
 * CON datos sin depender de qué número cayó dónde en el seed.
 */
function dayCellsWithSpending(page: Page) {
  // "martes, 4 de agosto · US$ 1,1 K" — el `·` solo aparece cuando ese día
  // tuvo gasto, así que este selector elige un día CON datos sin depender de
  // qué número cayó dónde en el seed.
  return page.getByRole("button", { name: /\d+ de \w+ · / });
}

/** El rango de un día: `from` y `to` a medianoche local de días consecutivos. */
const DAY_SCOPE_URL = /view=calendar.*from=\d{4}-\d{2}-\d{2}T.*to=\d{4}-\d{2}-\d{2}T/;

test.describe("calendario de movimientos", () => {
  test("prender el calendario no navega: la grilla y la lista conviven", async ({ page }) => {
    await seedDemoHousehold(page);
    await page.goto("/transactions");

    // Antes de prenderlo no hay grilla, y la lista ya está. El chip primero:
    // contar botones apenas termina el `goto` es una carrera con el render de
    // la lista, y da 0 sin que nada esté roto.
    await expect(calendarChip(page)).toBeVisible();
    await expect(dayCellsWithSpending(page)).toHaveCount(0);
    const rowsBefore = await page.locator("main").getByRole("button").count();
    expect(rowsBefore).toBeGreaterThan(2);

    await calendarChip(page).click();

    // Sigue siendo `/transactions` — el path no cambia, solo los params.
    await page.waitForURL(/\/transactions\?.*view=calendar/);
    await expect(page).toHaveURL(/from=/);
    await expect(page).toHaveURL(/to=/);

    // Y las dos cosas se ven a la vez, que es la decisión de producto de esta
    // pantalla en móvil: el calendario es contenido, no un encabezado fijo.
    await expect(page.getByRole("button", { name: "Mes anterior" })).toBeVisible();
    await expect(dayCellsWithSpending(page).first()).toBeVisible();
    await expect(page.getByText("Ingresos")).toBeVisible();

    // El chip queda anunciado como activo, no solo pintado.
    await expect(calendarChip(page)).toHaveAttribute("aria-pressed", "true");
  });

  test("elegir un día angosta la lista que ya está, y el chip de alcance la devuelve al mes", async ({ page }) => {
    await seedDemoHousehold(page);
    await page.goto("/transactions");

    // Por el chip y no navegando a `?view=calendar` a mano: entrar por la URL
    // deja la vista abierta pero SIN `from`/`to`, así que la lista sigue con
    // su preset por defecto. Después, volver "al mes entero" fija el rango del
    // mes — que no es el mismo conjunto de filas — y la comparación de abajo
    // se caía por una fila de diferencia. Es `openCalendar()` quien fija el
    // rango, y este test compara contra él.
    await calendarChip(page).click();
    await expect(dayCellsWithSpending(page).first()).toBeVisible();
    const monthRows = await page.locator("main").getByRole("button").count();

    const day = dayCellsWithSpending(page).first();
    const dayLabel = await day.getAttribute("aria-label");
    await day.click();

    // El alcance se escribe en `from`/`to`, los mismos params que ya
    // gobernaban el rango de la lista. No hay un `?day=` aparte.
    await page.waitForURL(DAY_SCOPE_URL);
    await expect(day).toHaveAttribute("aria-pressed", "true");

    // La lista se angostó: mismo componente, menos filas.
    const dayRows = await page.locator("main").getByRole("button").count();
    expect(dayRows).toBeLessThan(monthRows);

    // Y aparece el chip de alcance, que es la traducción del viejo "todo el
    // mes" — se ubica por su `aria-label` porque el texto visible es la fecha
    // abreviada del locale.
    const scopeChip = page.getByRole("button", { name: "Todo el mes" });
    await expect(scopeChip).toBeVisible();

    // Volver al mes entero: mismo path, y la lista se ensancha de nuevo.
    await scopeChip.click();
    await expect(scopeChip).toHaveCount(0);
    expect(await page.locator("main").getByRole("button").count()).toBe(monthRows);

    // El día quedó deseleccionado, no solo "sin chip".
    await expect(page.getByRole("button", { name: dayLabel! })).toHaveAttribute("aria-pressed", "false");
  });

  test("abrir un movimiento conserva el alcance, y atrás lo devuelve intacto", async ({ page }) => {
    await seedDemoHousehold(page);
    await page.goto("/transactions?view=calendar");

    await dayCellsWithSpending(page).first().click();
    await page.waitForURL(DAY_SCOPE_URL);
    const scopedUrl = page.url();

    // La primera fila de movimiento: las tres primeras del `main` son los
    // chips (Filtros, Calendario, alcance) y después vienen la navegación del
    // mes y las celdas, así que se busca por el `aria-label` que NO es una
    // celda ni un control conocido — la fila se ubica por su ícono + texto.
    await page.locator("main").getByRole("button").filter({ hasText: /US\$|AR\$|\$U/ }).first().click();

    // El detalle es una selección de esta misma pantalla y el alcance
    // `from`/`to` sobrevive: si no, cerrar devolvería a una lista sin filtrar.
    //
    // En MÓVIL el calendario sigue prendido: no compite con nada —es contenido
    // arriba de las filas, y el detalle abre en un `Modal` encima—, así que
    // apagarlo sería sacarle al usuario el mes que estaba recorriendo. En
    // escritorio sí se apaga, y eso se prueba en el describe del final.
    await page.waitForURL(/tx=/);
    await expect(page).toHaveURL(/view=calendar/);
    await expect(page).toHaveURL(/from=/);

    // Atrás cierra el detalle y devuelve el alcance exactamente como estaba.
    await page.goBack();
    await expect(page).toHaveURL(scopedUrl);
    await expect(page.getByRole("button", { name: "Todo el mes" })).toBeVisible();
  });

  test("apagar el calendario suelta el rango y devuelve la lista pelada", async ({ page }) => {
    await seedDemoHousehold(page);
    await page.goto("/transactions?view=calendar");
    await expect(page.getByRole("button", { name: "Mes anterior" })).toBeVisible();

    await calendarChip(page).click();

    await expect(page).not.toHaveURL(/view=calendar/);
    // El rango se suelta con la vista: el calendario ES el selector de fecha
    // mientras está abierto, así que al salir vuelve a mandar el preset.
    await expect(page).not.toHaveURL(/from=/);
    await expect(page.getByRole("button", { name: "Mes anterior" })).toHaveCount(0);
    await expect(calendarChip(page)).toHaveAttribute("aria-pressed", "false");
  });

  test("cambiar de mes deselecciona el día", async ({ page }) => {
    await seedDemoHousehold(page);
    await page.goto("/transactions?view=calendar");

    await dayCellsWithSpending(page).first().click();
    await expect(page.getByRole("button", { name: "Todo el mes" })).toBeVisible();

    await page.getByRole("button", { name: "Mes anterior" }).click();

    // No es un efecto aparte: el rango pasa a ser el del mes entero, y eso por
    // definición ya no es un día elegido.
    await expect(page.getByRole("button", { name: "Todo el mes" })).toHaveCount(0);
    await expect(page).toHaveURL(/view=calendar/);
  });

  test("la ruta vieja redirige a la vista", async ({ page }) => {
    await seedDemoHousehold(page);

    // Hay PWAs instaladas con esa entrada en el historial: un 404 ahí sería
    // una regresión, por eso `calendar/page.tsx` quedó como redirect.
    await page.goto("/transactions/calendar");

    await page.waitForURL(/\/transactions\?.*view=calendar/);
    await expect(page.getByRole("button", { name: "Mes anterior" })).toBeVisible();
  });
});

/**
 * La segunda columna del split (escritorio) tiene un solo ocupante y gana la
 * última acción explícita del usuario. Antes el detalle ganaba siempre: con un
 * movimiento abierto, tocar el chip no mostraba el calendario y no había forma
 * de volver a "nada seleccionado" desde la lista.
 *
 * Viewport propio: el resto del archivo corre en 390×844 (móvil), donde el
 * calendario va adentro del scroller de la lista y no hay segunda columna.
 */
test.describe("escritorio · el detalle y el calendario se turnan", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  /** Las filas de movimiento son los botones de la lista que llevan un monto. */
  function movementRows(page: Page) {
    return page.locator("main button").filter({ hasText: /\$/ });
  }

  test("tocar el movimiento ya seleccionado lo deselecciona", async ({ page }) => {
    await seedDemoHousehold(page);
    await page.goto("/transactions");

    const row = movementRows(page).first();
    await row.click();
    await expect(page).toHaveURL(/tx=/);

    await row.click();
    await expect(page).not.toHaveURL(/tx=/);
  });

  test("el chip del calendario deselecciona el movimiento y ocupa la columna", async ({ page }) => {
    await seedDemoHousehold(page);
    await page.goto("/transactions");

    await movementRows(page).first().click();
    await expect(page).toHaveURL(/tx=/);

    await calendarChip(page).click();

    await expect(page).toHaveURL(/view=calendar/);
    await expect(page).not.toHaveURL(/tx=/);
    await expect(page.getByRole("button", { name: "Mes anterior" })).toBeVisible();
  });

  test("elegir un movimiento apaga el calendario y conserva el rango", async ({ page }) => {
    await seedDemoHousehold(page);
    await page.goto("/transactions");
    // Por el chip y no navegando a `?view=calendar` a mano: es `openCalendar()`
    // quien fija el rango del mes, que es justamente lo que este test verifica
    // que sobreviva.
    await calendarChip(page).click();
    await expect(page.getByRole("button", { name: "Mes anterior" })).toBeVisible();

    await movementRows(page).first().click();

    await expect(page).toHaveURL(/tx=/);
    await expect(page).not.toHaveURL(/view=calendar/);
    await expect(calendarChip(page)).toHaveAttribute("aria-pressed", "false");
    // El rango sigue puesto: el día que se venía mirando no deja de filtrar la
    // lista de la izquierda solo porque se abrió un movimiento.
    await expect(page).toHaveURL(/from=/);
  });
});
