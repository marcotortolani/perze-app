import { describe, expect, it } from "vitest";
import { interpolateAmount } from "./CountUp";

describe("interpolateAmount — CON-07", () => {
  it("progreso 0 devuelve el punto de partida exacto", () => {
    expect(interpolateAmount(100n, 500n, 0)).toBe(100n);
  });

  it("progreso 1 devuelve el destino exacto", () => {
    expect(interpolateAmount(100n, 500n, 1)).toBe(500n);
  });

  it("progreso intermedio interpola linealmente", () => {
    expect(interpolateAmount(0n, 1000n, 0.5)).toBe(500n);
  });

  it("nunca pasa por Number() sobre montos que exceden MAX_SAFE_INTEGER", () => {
    // 10 cuatrillones de unidades mínimas — muy por encima de 2^53. Si esto
    // pasara por `Number(bigint)` en algún punto, perdería precisión en
    // silencio; con roundHalfEven sobre bigint, el extremo es exacto y el
    // intermedio es determinístico.
    const huge = 10_000_000_000_000_000_000n;
    expect(Number.isSafeInteger(Number(huge))).toBe(false);

    expect(interpolateAmount(0n, huge, 0)).toBe(0n);
    expect(interpolateAmount(0n, huge, 1)).toBe(huge);
    // a mitad de camino: exactamente la mitad, sin ruido de punto flotante
    expect(interpolateAmount(0n, huge, 0.5)).toBe(huge / 2n);
  });

  it("funciona igual con montos negativos (gasto vs. ingreso)", () => {
    expect(interpolateAmount(-1000n, 1000n, 0.5)).toBe(0n);
  });
});
