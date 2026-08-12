import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Guarda que `globals.css` no diverja en silencio de los valores numéricos
 * de `docs/02-design-system.md`. No parsea CSS de verdad: solo confirma que
 * cada valor documentado sigue apareciendo tal cual. Si este test falla
 * porque cambiaste un valor a propósito, actualizá también el doc 02 (y
 * viceversa) — nunca solo el CSS.
 */
const css = readFileSync(
  path.resolve(__dirname, "./globals.css"),
  "utf-8"
);

function expectToken(value: string) {
  expect(css).toContain(value);
}

describe("tokens de color — docs/02-design-system.md § 2", () => {
  it("neutros dark", () => {
    expectToken("#0a0a0b");
    expectToken("#131315");
    expectToken("#1b1b1e");
    expectToken("#26262a");
    expectToken("#2e2e33");
  });

  it("neutros light", () => {
    expectToken("#fafaf9");
    expectToken("#ffffff");
    expectToken("#f5f5f4");
    expectToken("#eeeeec");
    expectToken("#e4e4e1");
  });

  it("marca — violeta índigo (dos hexes por modo + un relleno)", () => {
    expectToken("#8b7cf6"); // tinta dark
    expectToken("#5d45e8"); // tinta light
    expectToken("#6d55f0"); // relleno, ambos modos
  });

  it("secundario aqua y acento naranja", () => {
    expectToken("#199e70");
    expectToken("#0d7a58"); // D6 — aqua-light oscurecido, antes #12916a (3.42:1, no llegaba a AA)
    expectToken("#e06a35");
    expectToken("#b8451a"); // D6 — orange-light oscurecido, antes #d95926 (3.34:1)
  });

  it("estado — good/warning/serious fijos en ambos modos; critical per-modo desde D7", () => {
    expectToken("#0ca30c"); // good
    expectToken("#fab219"); // warning
    expectToken("#ec835a"); // serious
    expectToken("#d03b3b"); // critical — base, sigue siendo el valor en claro
    expectToken("#e8615f"); // D7 — critical en oscuro, antes heredaba #d03b3b (3.58:1, no llegaba a AA)
  });

  it("slots de datos 4 (azul) y 5 (magenta)", () => {
    expectToken("#3987e5");
    expectToken("#2a78d6");
    expectToken("#d55181");
    expectToken("#c9457a");
  });
});

describe("tipografía — docs/02-design-system.md § 3", () => {
  it("escala completa, 6 niveles", () => {
    // hero-xl/hero: `clamp()`, no un valor fijo — nace más chico en una
    // pantalla angosta (fix del recorte de cifras grandes en mobile), pero
    // el TECHO documentado en docs/02 (64/40) sigue siendo el mismo, así
    // que el guard sigue verificando que no se haya movido en silencio.
    expectToken("clamp(40px, 11vw, 64px)"); // --text-hero-xl-size
    expectToken("clamp(28px, 7vw, 40px)"); // --text-hero-size
    expectToken("--text-title-size: 22px");
    expectToken("--text-body-size: 16px");
    expectToken("--text-label-size: 13px");
    expectToken("--text-caption-size: 11px");
  });
});

describe("geometría y espacio — docs/02-design-system.md § 4", () => {
  it("grid y zonas", () => {
    expectToken("--screen-padding: 20px");
    expectToken("--block-gap: 24px");
    expectToken("--tabbar-height: 64px");
    expectToken("--header-height: 56px");
    expectToken("--fab-size: 64px");
    expectToken("--thumb-zone: 200px");
    expectToken("--touch-min: 44px");
  });

  it("safe areas — Tab bar 64px + safe area, no 64px con el inset comido adentro", () => {
    expectToken("--tabbar-height: 64px");
    expectToken("--safe-top: env(safe-area-inset-top, 0px)");
    expectToken("--safe-bottom: env(safe-area-inset-bottom, 0px)");
    expectToken("--tabbar-total-height: calc(var(--tabbar-height) + var(--safe-bottom))");
  });

  it("radios", () => {
    expectToken("--radius-input: 14px");
    expectToken("--radius-button: 16px");
    expectToken("--radius-card: 20px");
    expectToken("--radius-keypad-key: 20px");
    expectToken("--radius-sheet: 28px");
    expectToken("--radius-chip: 999px");
  });
});

describe("motion — docs/02-design-system.md § 5.1", () => {
  it("duraciones, ninguna transición de interfaz supera 320ms", () => {
    expectToken("--duration-micro: 120ms");
    expectToken("--duration-fast: 180ms");
    expectToken("--duration-base: 240ms");
    expectToken("--duration-slow: 320ms");
  });

  it("reduced motion", () => {
    expectToken("prefers-reduced-motion: reduce");
  });
});

// D4-D7 (docs/plan-resolucion-auditoria-tecnica.md) — contraste real, no
// "el valor sigue siendo el documentado": fórmula WCAG 2.x de luminancia
// relativa (misma que usó la auditoría), no una aproximación a ojo.
function relativeLuminance(hex: string): number {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r!) + 0.7152 * linear(g!) + 0.0722 * linear(b!);
}

function contrastRatio(hexA: string, hexB: string): number {
  const [l1, l2] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort((a, b) => b - a);
  return (l1! + 0.05) / (l2! + 0.05);
}

const AA_NORMAL_TEXT = 4.5;

describe("contraste AA — D4-D7 (docs/plan-resolucion-auditoria-tecnica.md § tokens)", () => {
  it("D5 — --text-muted (n-ink3) llega a AA contra --surface-3, el peor caso (la superficie más parecida al propio ink3)", () => {
    expect(contrastRatio("#8e8e96", "#26262a")).toBeGreaterThanOrEqual(AA_NORMAL_TEXT); // dark
    expect(contrastRatio("#6b6b71", "#eeeeec")).toBeGreaterThanOrEqual(AA_NORMAL_TEXT); // light
  });

  it("D6 — --aqua-light y --orange-light (polaridad) llegan a AA en modo claro", () => {
    expect(contrastRatio("#0d7a58", "#fafaf9")).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    expect(contrastRatio("#b8451a", "#fafaf9")).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it("D7 — --critical llega a AA en modo oscuro (contra --surface-2, donde vive el error de formulario)", () => {
    expect(contrastRatio("#e8615f", "#1b1b1e")).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it("D4 — --warning falla AA como texto en modo claro (por eso va solo en ícono/tinte de fondo, nunca en el label)", () => {
    expect(contrastRatio("#fab219", "#fafaf9")).toBeLessThan(AA_NORMAL_TEXT);
  });
});
