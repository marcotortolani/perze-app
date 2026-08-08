import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { seedDemoHousehold } from "./helpers";

/**
 * El caso reportado, de punta a punta: **PWA instalada, sin internet, la app
 * cerrada del todo — cargar un gasto tiene que funcionar igual.**
 *
 * Corre contra un build de producción (proyecto `mobile-chromium-pwa` en
 * `playwright.config.ts`) porque en desarrollo el service worker no se
 * registra, y sin service worker no hay nada que probar acá.
 *
 * Usa el household de demo a propósito: no crea sesión de Supabase, pero sí
 * deja household, cuentas y categorías en Dexie, que es todo lo que
 * `CaptureFlow` necesita. Lo que estos tests ejercitan es la capa PWA
 * —precache, proxy, gates y la pantalla `/offline`—; la mitad de identidad
 * (que `getSession()` devuelva `null` sin red no expulse a `/onboarding`)
 * vive en `src/hooks/use-current-user.test.tsx`, que no necesita navegador.
 */

/**
 * Espera a que el service worker esté activo Y a que el precache tenga
 * contenido. Las dos cosas: `serviceWorker.ready` resuelve cuando el SW
 * está activo, pero la instalación baja ~150 entradas y arrancar el test
 * antes de que terminen lo vuelve flaky sin ningún motivo real.
 */
async function waitForPrecache(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const name = (await caches.keys()).find((key) => key.includes("precache"));
          if (!name) return 0;
          return (await (await caches.open(name)).keys()).length;
        }),
      { timeout: 30_000 }
    )
    .toBeGreaterThan(50);
}

/**
 * Deja una ruta NO precacheada guardada en el cache de navegación, para
 * poder abrirla después sin red. Se hace en dos pasos y en este orden a
 * propósito: el service worker arranca con `clientsClaim: false`, así que
 * no controla la página que lo registró — visitar la ruta antes de que
 * esté activo la deja sin cachear y el test terminaría, con razón, en
 * `/offline`.
 */
async function warmRuntimeCache(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect
    .poll(
      () =>
        page.evaluate(async (target) => {
          for (const name of await caches.keys()) {
            if (!name.includes("pages")) continue;
            const keys = await (await caches.open(name)).keys();
            if (keys.some((request) => new URL(request.url).pathname === target)) return true;
          }
          return false;
        }, path),
      { timeout: 15_000 }
    )
    .toBe(true);
}

/**
 * "Cerré la app del todo y la volví a abrir." Cerrar la página y abrir otra
 * en el MISMO `BrowserContext` conserva IndexedDB, cookies, localStorage y
 * el registro del service worker, que es exactamente lo que sobrevive a
 * matar una PWA. Un `page.reload()` no sirve: mantiene el `controller` del
 * service worker vivo y no reproduce el arranque en frío.
 */
async function relaunchOffline(context: BrowserContext, page: Page): Promise<Page> {
  await context.setOffline(true);
  await page.close();
  return context.newPage();
}

test("arranque en frío sin red: /add carga desde el precache", async ({ page, context }) => {
  await seedDemoHousehold(page);
  await waitForPrecache(page);

  const relaunched = await relaunchOffline(context, page);
  await relaunched.goto("/add");

  // El keypad, no el fallback: si `/add` no estuviera precacheada —o si el
  // precache tuviera guardada la redirección a `/onboarding`— acá se vería
  // la pantalla de sin conexión.
  await expect(relaunched.getByRole("button", { name: "5", exact: true })).toBeVisible();
  expect(new URL(relaunched.url()).pathname).toBe("/add");
});

test("share target sin red: /add con parámetros también sale del precache", async ({ page, context }) => {
  await seedDemoHousehold(page);
  await waitForPrecache(page);

  const relaunched = await relaunchOffline(context, page);
  // Lo que manda el `share_target` del manifest. Sin
  // `ignoreURLParametersMatching` en `sw.ts`, esta URL no matchea la entrada
  // `/add` del precache y termina en `/offline`.
  await relaunched.goto("/add?title=Cafe&note=con%20Ana");

  await expect(relaunched.getByRole("button", { name: "5", exact: true })).toBeVisible();
  expect(new URL(relaunched.url()).pathname).toBe("/add");
});

test("sin red se guarda el gasto y sobrevive a otro arranque en frío", async ({ page, context }) => {
  await seedDemoHousehold(page);
  await waitForPrecache(page);
  // `/transactions` no está precacheada (solo `/add` y `/offline` lo están),
  // así que hay que dejarla en el cache de runtime con red antes de cortarla:
  // sin esto el test terminaría en la pantalla de sin conexión, que sería el
  // comportamiento correcto pero no lo que se quiere medir acá.
  await warmRuntimeCache(page, "/transactions");

  const offlinePage = await relaunchOffline(context, page);
  await offlinePage.goto("/add");
  // Se elige la cuenta explícitamente en vez de confiar en la que venga por
  // defecto: cuál es depende de en qué orden resolvieron las queries, y
  // "Efectivo" —una de las candidatas— queda en negativo por los propios
  // movimientos del seed, así que el keypad bloquea el guardado con "Saldo
  // insuficiente" hasta para $U 7. Lo que este test prueba es el guardado
  // sin red, no esa regla. El botón de cuenta se ubica por su sufijo de
  // moneda, que es lo único estable de su etiqueta.
  await offlinePage.getByRole("button", { name: /·\s(UYU|USD)$/ }).click();
  await offlinePage.getByText("Itaú Caja de Ahorro").click();
  await offlinePage.getByRole("button", { name: "7", exact: true }).click();
  // Cuál categoría frecuente se ofrece depende de la cuenta elegida, así que
  // se toma la primera en vez de nombrar una: lo que importa acá es que un
  // tap en una categoría guarda, no cuál categoría es.
  await offlinePage.getByRole("button", { name: /^(Supermercado|Restaurantes|Transporte|Vivienda|Salud|Entretenimiento)$/ }).first().click();

  // El aviso de cola va DESPUÉS de guardar, nunca antes (ver el comentario
  // de `src/app/offline/page.tsx`).
  await expect(offlinePage.getByText("Guardado en el teléfono")).toBeVisible();

  // Todavía sin red: el movimiento tiene que estar en Dexie, no en un
  // estado en memoria que se pierde al cerrar.
  const reopened = await context.newPage();
  await offlinePage.close();
  await reopened.goto("/transactions");
  await expect(reopened.getByText("7,00").first()).toBeVisible();
});

test("la pantalla /offline ofrece cargar un movimiento y no vuelve a sí misma", async ({ page, context }) => {
  await seedDemoHousehold(page);
  await waitForPrecache(page);

  const relaunched = await relaunchOffline(context, page);
  // Una ruta que nunca se visitó: no está ni en el precache ni en el cache
  // de runtime, así que cae en el fallback.
  await relaunched.goto("/analysis/una-ruta-que-no-existe-todavia");

  await expect(relaunched.getByRole("button", { name: "Cargar un movimiento" })).toBeVisible();
  await expect(relaunched.getByRole("button", { name: "Recargar la app" })).toBeVisible();
  await expect(relaunched.getByText(/se sincroniza solo/)).toBeVisible();

  // Este assert es el que agarra el loop `/offline` → `/add` →
  // `/onboarding` → `/offline` si alguien deshace el guard de
  // `src/app/add/page.tsx` o la exención de `OnboardingGate`.
  await relaunched.getByRole("button", { name: "Cargar un movimiento" }).click();
  await expect(relaunched.getByRole("button", { name: "5", exact: true })).toBeVisible();
  expect(new URL(relaunched.url()).pathname).toBe("/add");
});
