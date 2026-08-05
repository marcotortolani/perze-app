import { expect, type Page } from "@playwright/test";

/**
 * A2 → "Probar con datos de ejemplo" (`src/app/onboarding/page.tsx`) — el
 * mismo atajo que usa el bloque A para construir B/D/E antes de tener el
 * onboarding real. Deja un household + 5 cuentas (incluida "Ahorros USD",
 * moneda distinta a la base) + ~40 movimientos ya sembrados. **No** siembra
 * metas, presupuestos, deudas ni portfolios — esos módulos arrancan
 * apagados (`enabled_modules: []`), ver `enableModule()`.
 */
export async function seedDemoHousehold(page: Page): Promise<void> {
  await page.goto("/onboarding");
  // AC-6 — sin sesión y sin marca de "ya visto", `/onboarding` redirige a
  // `/onboarding/welcome` (A1) antes de mostrar el botón de demo. Esa marca
  // vive en localStorage, así que un contexto nuevo de Playwright siempre la
  // pisa. El redirect ocurre adentro de un efecto async que primero espera a
  // `supabase.auth.getUser()`: `/onboarding` renderiza su propio contenido
  // (incluido el botón de demo) durante esa ventana, ANTES de que el efecto
  // resuelva y dispare el `router.replace`. Mirar la URL o el DOM ahí es una
  // carrera — hay que esperar a que esa llamada de red termine primero.
  await page.waitForLoadState("networkidle");
  const skipWelcome = page.getByRole("button", { name: "Empezar" });
  const demoButton = page.getByText("Probar con datos de ejemplo");
  if (await skipWelcome.isVisible().catch(() => false)) {
    await skipWelcome.click();
  }
  await demoButton.waitFor({ state: "visible" });
  await demoButton.click();
  await page.waitForURL("/");
}

/**
 * Prende un módulo opcional desde `/more/modules` — todos arrancan
 * apagados en el seed de demo. El `Switch` de esa fila no tiene nombre
 * accesible propio (`aria-labelledby` apunta a un id que ningún elemento
 * tiene), así que no se puede ubicar con `getByRole("switch", {name})`:
 * se ubica por el texto de la fila y se toma el switch hermano.
 */
export async function enableModule(page: Page, label: string): Promise<void> {
  await page.goto("/more/modules");
  // La fila es `<div row><div flex:1><div label/><div desc/></div><Switch/></div>` —
  // el texto está DOS niveles abajo del row que también tiene el switch,
  // no uno (`getByText(...).locator("..")` da el `flex:1`, no el row).
  await page.getByText(label, { exact: true }).locator("../..").getByRole("switch").click();
}

/**
 * El bug de "push deja el formulario atrapado en el historial": después de
 * `save()`, confirma que se aterrizó en `expectedUrlAfterSave`, y que UN
 * SOLO `goBack()` desde ahí NUNCA vuelve a `formUrl` (la pantalla del
 * formulario/acción que se estaba probando). Antes de eso, `save` ya tiene
 * que haber dejado alguna confirmación visible (toast, dato actualizado)
 * — eso es lo que prueba que la acción real no se rompió, no solo la
 * navegación.
 *
 * Deliberadamente NO afirma a qué URL exacta llega el `goBack()` — un
 * `page.goto()` previo (inevitable al arrancar cada test desde la lista)
 * ya agrega su propia entrada de historial, así que "adónde vuelve
 * exactamente" depende de cómo se llegó a la lista, no solo del fix. Lo
 * único que el bug real garantiza romper es "vuelve a caer en el
 * formulario abandonado" — eso es lo único que hace falta afirmar.
 *
 * Segunda aserción, agregada tras un bug residual real: `replace(url)`
 * hacia una `url` IDÉNTICA a la que ya estaba debajo en el historial (el
 * caso normal — "guardar" vuelve adonde ya se estaba) duplica esa entrada
 * en vez de evitarla. El historial quedaba `[detalle, detalle]`, no
 * `[detalle]`: la aserción de arriba no lo agarraba porque el primer
 * `goBack()` caía en el DUPLICADO de `expectedUrlAfterSave`, no en
 * `formUrl` — pasaba el test aunque la pantalla no se hubiera movido ni un
 * pelo. Se agarra afirmando que ese mismo `goBack()` tampoco deja la URL
 * IGUAL a donde ya se estaba parado: un "volver" que no cambia nada es
 * exactamente el síntoma reportado ("toco volver y no pasa nada, recién
 * el segundo toque funciona").
 */
export async function expectReplaceNotPush(
  page: Page,
  { formUrl, save, expectedUrlAfterSave }: { formUrl: string; save: () => Promise<void>; expectedUrlAfterSave: string | RegExp }
): Promise<void> {
  await save();
  await page.waitForURL(expectedUrlAfterSave);
  const landedUrl = page.url();
  await page.goBack();
  await expect(page).not.toHaveURL(formUrl);
  await expect(page).not.toHaveURL(landedUrl);
}
