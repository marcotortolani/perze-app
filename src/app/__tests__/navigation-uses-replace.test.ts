import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regresión liviana del bug de historial. Dos capítulos:
 *
 * 1. Una pantalla alcanzada con `router.push()` que vuelve a hacer
 *    `router.push()` (en vez de volver hacia atrás) al guardar/archivar/
 *    borrar deja el formulario atrapado en el historial.
 * 2. El fix original de (1) usaba `router.replace(url)` hacia la MISMA
 *    `url` que ya estaba debajo en el historial (el caso normal: guardar
 *    vuelve adonde ya se estaba) — eso DUPLICABA esa entrada en vez de
 *    evitarla, y "volver" necesitaba dos toques (bug reportado a mano en
 *    `recurring/[id]/edit`, confirmado en los ~16 sitios que comparten el
 *    patrón). El fix real es `router.back()`: nunca agrega una entrada,
 *    solo recorre el historial que ya existe.
 *
 * La prueba real de esto es `e2e/navigation-replace.spec.ts` (necesita el
 * historial real del navegador, algo que un mock de `useRouter()` no
 * reproduce — ver el comentario ahí). Esto es solo un guardarraíl barato:
 * si alguien reintroduce `push` o vuelve a un `replace(url)` puntual en
 * vez de `back()`, este test falla en segundos sin levantar Playwright.
 *
 * Deliberadamente NO es un regex genérico que prohíba `router.push` en
 * todo el archivo — cada uno de estos archivos tiene pushes legítimos
 * (navegación hacia adelante a un registro nuevo, sheets, etc.) que deben
 * seguir existiendo. Tampoco alcanza con "el archivo tiene ALGÚN
 * `router.back()`" — casi todos ya tenían uno propio en el botón "Volver"
 * del header (`usePageHeader({ onBack: () => router.back() })`); por eso
 * se cuenta la cantidad exacta de ocurrencias esperadas, no solo su
 * presencia.
 */

const ROOT = join(__dirname, "../../..");

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf-8");
}

function countBackCalls(code: string): number {
  // Descarta líneas de comentario `//` antes de contar — algunos de estos
  // archivos EXPLICAN el fix en un comentario que menciona `router.back()`
  // como texto, y eso no es una llamada real.
  const codeOnly = code
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
  return (codeOnly.match(/router\.back\(\)/g) ?? []).length;
}

describe("router.back() en vez de router.replace(url)/router.push(url) al volver de un formulario", () => {
  // Cada caso: el archivo no debe volver a tener un `router.replace(`
  // puntual (serían candidatos a duplicar la entrada de historial otra
  // vez), y debe tener exactamente la cantidad de `router.back()`
  // esperada — la del handler de guardar/archivar/borrar, más la del
  // botón "Volver" del header si ese archivo ya la tenía de antes.
  const cases: Array<{ label: string; path: string; expectedBackCalls: number }> = [
    // El detalle dejó de ser una ruta (`/accounts/[id]`) y pasó a ser una
    // selección con search param dentro de `/accounts` — los dos `back()` de
    // archivar/desarchivar viven ahora en `AccountDetailContent.tsx`.
    // `[id]/page.tsx` quedó como un redirect de compatibilidad y por eso ya
    // no está en esta lista (su `router.replace` es correcto ahí).
    { label: "accounts/AccountDetailContent.tsx — archivar/desarchivar", path: "src/app/(app)/accounts/AccountDetailContent.tsx", expectedBackCalls: 2 },
    { label: "accounts/[id]/reconcile/page.tsx — confirmar", path: "src/app/(app)/accounts/[id]/reconcile/page.tsx", expectedBackCalls: 2 },
    { label: "accounts/[id]/edit/page.tsx — cerrar y guardar", path: "src/app/accounts/[id]/edit/page.tsx", expectedBackCalls: 2 },
    { label: "goals/[id]/page.tsx — borrar", path: "src/app/(app)/goals/[id]/page.tsx", expectedBackCalls: 2 },
    { label: "goals/new/page.tsx — crear", path: "src/app/(app)/goals/new/page.tsx", expectedBackCalls: 2 },
    { label: "budgets/[id]/page.tsx — borrar", path: "src/app/(app)/budgets/[id]/page.tsx", expectedBackCalls: 2 },
    { label: "budgets/new/page.tsx — crear", path: "src/app/(app)/budgets/new/page.tsx", expectedBackCalls: 2 },
    { label: "debts/new/page.tsx — crear", path: "src/app/(app)/debts/new/page.tsx", expectedBackCalls: 2 },
    { label: "more/rules/new/page.tsx — crear", path: "src/app/(app)/more/rules/new/page.tsx", expectedBackCalls: 2 },
    { label: "investments/[portfolioId]/trades/new/page.tsx — crear operación", path: "src/app/(app)/investments/[portfolioId]/trades/new/page.tsx", expectedBackCalls: 2 },
    { label: "investments/[portfolioId]/instruments/new/page.tsx — crear instrumento", path: "src/app/(app)/investments/[portfolioId]/instruments/new/page.tsx", expectedBackCalls: 2 },
    // Mismo movimiento que cuentas: el detalle dejó de ser una ruta
    // (`/transactions/[id]`) y pasó a ser una selección con search param
    // dentro de `/transactions`. El `back()` de borrar vive ahora en
    // `TransactionDetailContent.tsx`, y es uno solo: el del header lo
    // registra el contenedor (`page.tsx`), no el detalle. `[id]/page.tsx`
    // quedó como redirect de compatibilidad y por eso ya no está en esta
    // lista (su `router.replace` es correcto ahí).
    { label: "transactions/TransactionDetailContent.tsx — borrar", path: "src/app/(app)/transactions/TransactionDetailContent.tsx", expectedBackCalls: 1 },
    { label: "transactions/[id]/split/page.tsx — guardar reparto", path: "src/app/transactions/[id]/split/page.tsx", expectedBackCalls: 2 },
    { label: "transactions/[id]/edit/page.tsx — cerrar editor", path: "src/app/transactions/[id]/edit/page.tsx", expectedBackCalls: 1 },
    { label: "recurring/[id]/edit/page.tsx — guardar", path: "src/app/(app)/recurring/[id]/edit/page.tsx", expectedBackCalls: 2 },
    { label: "recurring/new/page.tsx — crear", path: "src/app/(app)/recurring/new/page.tsx", expectedBackCalls: 2 },
  ];

  for (const { label, path, expectedBackCalls } of cases) {
    it(label, () => {
      const code = source(path);
      expect(code).not.toMatch(/router\.replace\(/);
      expect(countBackCalls(code)).toBe(expectedBackCalls);
    });
  }

  // Pushes legítimos que NO deben convertirse en replace/back — si alguien
  // los "corrige" por error, este test lo marca.
  it("transactions/TransactionDetailContent.tsx — duplicar sigue usando push (es un registro nuevo)", () => {
    const code = source("src/app/(app)/transactions/TransactionDetailContent.tsx");
    expect(code).toMatch(/next\.set\("tx", copy\.id\)/);
    expect(code).toMatch(/router\.push\(`\/transactions\?\$\{next\.toString\(\)\}`/);
  });
});
