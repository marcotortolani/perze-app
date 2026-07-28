import type { Page } from "@playwright/test";

/**
 * A2 → "Probar con datos de ejemplo" (`src/app/onboarding/page.tsx`) — el
 * mismo atajo que usa el bloque A para construir B/D/E antes de tener el
 * onboarding real. Deja un household + 5 cuentas (incluida "Ahorros USD",
 * moneda distinta a la base) + ~40 movimientos ya sembrados.
 */
export async function seedDemoHousehold(page: Page): Promise<void> {
  await page.goto("/onboarding");
  await page.getByText("Probar con datos de ejemplo").click();
  await page.waitForURL("/");
}
