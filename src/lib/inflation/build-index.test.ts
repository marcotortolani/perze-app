import { describe, expect, it } from "vitest";
import { buildPriceIndexFromMonthlyChanges, MIN_INFLATION_PERIOD } from "./build-index";

describe("buildPriceIndexFromMonthlyChanges", () => {
  it("ancla el primer período en 100 y compone los siguientes", () => {
    const points = buildPriceIndexFromMonthlyChanges([
      { period: "2026-04", momPct: 2.6 },
      { period: "2026-05", momPct: 2.1 },
      { period: "2026-06", momPct: 1.9 },
    ]);
    expect(points[0]).toEqual({ period: "2026-04", indexValue: 100 });
    expect(points[1]?.indexValue).toBeCloseTo(102.1); // 100 * 1.021
    expect(points[2]?.indexValue).toBeCloseTo(102.1 * 1.019);
  });

  it("ordena cronológicamente sin importar el orden de entrada", () => {
    const points = buildPriceIndexFromMonthlyChanges([
      { period: "2026-06", momPct: 1.9 },
      { period: "2026-04", momPct: 2.6 },
      { period: "2026-05", momPct: 2.1 },
    ]);
    expect(points.map((p) => p.period)).toEqual(["2026-04", "2026-05", "2026-06"]);
  });

  it("el ratio entre dos períodos no depende de la base elegida (100)", () => {
    const points = buildPriceIndexFromMonthlyChanges([
      { period: "2026-04", momPct: 2.6 },
      { period: "2026-05", momPct: 2.1 },
    ]);
    const ratio = points[1]!.indexValue / points[0]!.indexValue;
    expect(ratio).toBeCloseTo(1.021);
  });

  it("serie vacía devuelve vacío", () => {
    expect(buildPriceIndexFromMonthlyChanges([])).toEqual([]);
  });

  it("anclar en MIN_INFLATION_PERIOD (1992-01) no desborda numeric(24,12) para el rango de vida útil de la app", () => {
    // ~35 años de inflación argentina promedio compuesta, aproximado con una
    // tasa mensual constante bien por encima de la real — sanity check de
    // orden de magnitud, no un valor exacto contra la fuente.
    const months = 35 * 12;
    const changes = Array.from({ length: months }, (_, i) => ({ period: `sim-${i}`, momPct: 3 }));
    const points = buildPriceIndexFromMonthlyChanges(changes);
    const last = points.at(-1)!.indexValue;
    expect(last).toBeLessThan(10 ** 12); // límite de numeric(24,12)
  });
});

describe("MIN_INFLATION_PERIOD", () => {
  it("es enero de 1992 (Plan de Convertibilidad) — el corte que evita el overflow", () => {
    expect(MIN_INFLATION_PERIOD).toBe("1992-01");
  });
});
