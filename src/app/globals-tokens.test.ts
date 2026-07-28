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
    expectToken("#12916a");
    expectToken("#e06a35");
    expectToken("#d95926");
  });

  it("estado — fijo, nunca tematizado", () => {
    expectToken("#0ca30c"); // good
    expectToken("#fab219"); // warning
    expectToken("#ec835a"); // serious
    expectToken("#d03b3b"); // critical
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
    expectToken("--text-hero-xl-size: 64px");
    expectToken("--text-hero-size: 40px");
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
