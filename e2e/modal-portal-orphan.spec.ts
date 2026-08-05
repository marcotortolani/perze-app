import { test, expect } from "@playwright/test";
import { seedDemoHousehold } from "./helpers";

/**
 * § 4 de `docs/auditoria-rutas-interceptoras.md` — el riesgo de "portal
 * huérfano".
 *
 * `Modal` hace `createPortal(overlay, document.body)`, y ese overlay es
 * `position: fixed; inset: 0; z-index: 50` con fondo opaco: si sobrevive a un
 * "volver", tapa la pantalla entera y la app queda inutilizable sin recargar.
 *
 * Por qué puede sobrevivir: con `cacheComponents: true` (activo en
 * `next.config.ts`), `router.back()` NO desmonta una pantalla de ruta — la
 * deja oculta en modo `Activity`. Y `Activity` oculta su propio subárbol, no
 * lo que ese subárbol portaleó a `document.body`. Cualquier ruta interceptada
 * que renderice un portal está expuesta.
 *
 * Quedan dos interceptoras vivas y las dos usan `Modal` sin `contained`:
 * `@modal/(.)add` y `@modal/(.)accounts/new`. La auditoría verificó el caso
 * en escritorio; esto cubre MOBILE, que es donde el overlay ocupa el 100% de
 * la pantalla y donde el síntoma sería total.
 *
 * La aserción fuerte no es la de "no se ve el contenido del modal" sino el
 * `click` posterior: Playwright falla un click si otro elemento intercepta los
 * eventos de puntero, que es exactamente lo que haría un overlay huérfano
 * aunque fuera invisible.
 */
test.describe.configure({ mode: "serial" });

test("volver desde /add interceptado no deja el overlay tapando la pantalla", async ({ page }) => {
  await seedDemoHousehold(page);

  // Navegación BLANDA desde adentro del shell: es la que activa el
  // interceptor. Un `goto("/add")` iría a la ruta real y no probaría nada.
  await page.getByRole("link", { name: "Agregar" }).click();
  await page.waitForURL("/add");
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeVisible();

  await page.goBack();
  await page.waitForURL("/");

  // El contenido del modal ya no se ve. `toBeHidden` y no `toHaveCount(0)`:
  // con `cacheComponents` el subárbol puede quedar MONTADO pero oculto
  // (`Activity`) en vez de desmontarse, y eso está bien — lo que no puede
  // pasar es que siga visible o siga tapando.
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeHidden();
  // ...y la pantalla de abajo recibe eventos de verdad. Si el overlay quedara
  // huérfano, este click fallaría por "intercepts pointer events".
  await page.getByRole("link", { name: "Movim." }).click();
  await page.waitForURL("/transactions");
});

test("volver desde /accounts/new interceptado no deja el overlay tapando la pantalla", async ({ page }) => {
  await seedDemoHousehold(page);
  await page.goto("/accounts");

  await page.getByRole("button", { name: "Nueva cuenta" }).click();
  await page.waitForURL("/accounts/new");
  // "Billetes y monedas" (subtítulo de "Efectivo" en el selector de tipo de
  // cuenta) y no el nombre de un tipo: "Caja de ahorro" también aparece en el
  // meta de las cuentas de la lista de atrás, que sigue montada debajo del
  // modal, así que no distingue el overlay del fondo.
  await expect(page.getByText("Billetes y monedas", { exact: true })).toBeVisible();

  await page.goBack();
  await page.waitForURL("/accounts");

  // Igual que en /add: acá el subárbol SÍ queda montado y oculto, así que
  // exigir que desaparezca del DOM sería exigir un detalle de implementación.
  await expect(page.getByText("Billetes y monedas", { exact: true })).toBeHidden();
  await page.getByRole("link", { name: "Movim." }).click();
  await page.waitForURL("/transactions");
});
