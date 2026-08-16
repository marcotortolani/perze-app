import { describe, expect, it } from "vitest";
import { computeRebalance, UNASSIGNED_KEY } from "./rebalance";
import type { ValuationInstrument, ValuedPosition } from "./position-valuation";
import type { TargetAllocation } from "@/lib/repos/target-allocations-repo";

const AC_STOCKS = "ac-stocks";
const AC_BONDS = "ac-bonds";
const AC_CASH = "ac-cash";

const instrumentById = new Map<string, ValuationInstrument>([
  ["i-stock", { id: "i-stock", currencyCode: "USD", assetClassId: AC_STOCKS }],
  ["i-bond", { id: "i-bond", currencyCode: "USD", assetClassId: AC_BONDS }],
  ["i-cash", { id: "i-cash", currencyCode: "USD", assetClassId: AC_CASH }],
]);

const assetClassById = new Map([
  [AC_STOCKS, { id: AC_STOCKS, defaultRisk: "high" }],
  [AC_BONDS, { id: AC_BONDS, defaultRisk: "low" }],
  [AC_CASH, { id: AC_CASH, defaultRisk: "low" }],
]);

function target(key: string, targetPct: number, bandPct = 5): TargetAllocation {
  return { id: key, portfolioId: "p1", dimension: "asset_class", key, targetPct, bandPct };
}

describe("computeRebalance", () => {
  it("computes drift and suggested amount for a 3-class portfolio with 2 targets defined", () => {
    // 6000 total: 3000 stocks (50%), 2000 bonds (33.3%), 1000 cash (16.7%, sin target)
    const positions: ValuedPosition[] = [
      { instrumentId: "i-stock", quantity: 10, baseValue: 3000n },
      { instrumentId: "i-bond", quantity: 10, baseValue: 2000n },
      { instrumentId: "i-cash", quantity: 10, baseValue: 1000n },
    ];
    const targets = [target(AC_STOCKS, 40), target(AC_BONDS, 40)];
    const result = computeRebalance({
      dimension: "asset_class",
      valuedPositions: positions,
      totalValue: 6000n,
      excludedCount: 0,
      instrumentById,
      assetClassById,
      targets,
      baseCurrency: "USD",
    });

    // Solo 2 filas: cash no tiene target definido, no aparece.
    expect(result.rows).toHaveLength(2);

    const stocksRow = result.rows.find((r) => r.key === AC_STOCKS)!;
    expect(stocksRow.actualPct).toBeCloseTo(50, 5);
    expect(stocksRow.targetPct).toBe(40);
    expect(stocksRow.driftPct).toBeCloseTo(10, 5);
    expect(stocksRow.withinBand).toBe(false); // drift 10pp > banda 5pp
    // target: 40% de 6000 = 2400; actual 3000 -> vender 600
    expect(stocksRow.suggestedAmount).toBe(-600n);

    const bondsRow = result.rows.find((r) => r.key === AC_BONDS)!;
    expect(bondsRow.actualPct).toBeCloseTo((2000 / 6000) * 100, 5);
    // drift = 33.33 - 40 = -6.67, banda 5 -> fuera de banda
    expect(bondsRow.withinBand).toBe(false);
    // target: 40% de 6000 = 2400; actual 2000 -> comprar 400
    expect(bondsRow.suggestedAmount).toBe(400n);
  });

  it("marks a row within band when drift does not exceed band_pct", () => {
    const positions: ValuedPosition[] = [{ instrumentId: "i-stock", quantity: 10, baseValue: 4200n }];
    const targets = [target(AC_STOCKS, 40, 5)]; // actual 42% vs target 40%, drift 2pp <= banda 5pp
    const result = computeRebalance({
      dimension: "asset_class",
      valuedPositions: positions,
      totalValue: 10000n,
      excludedCount: 0,
      instrumentById,
      assetClassById,
      targets,
      baseCurrency: "USD",
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.withinBand).toBe(true);
  });

  it("groups by risk dimension via the instrument's asset class default_risk", () => {
    const positions: ValuedPosition[] = [
      { instrumentId: "i-stock", quantity: 10, baseValue: 6000n }, // high
      { instrumentId: "i-bond", quantity: 10, baseValue: 3000n }, // low
      { instrumentId: "i-cash", quantity: 10, baseValue: 1000n }, // low
    ];
    const targets = [target("high", 50), target("low", 50)];
    const result = computeRebalance({
      dimension: "risk",
      valuedPositions: positions,
      totalValue: 10000n,
      excludedCount: 0,
      instrumentById,
      assetClassById,
      targets,
      baseCurrency: "USD",
    });
    const lowRow = result.rows.find((r) => r.key === "low")!;
    expect(lowRow.actualPct).toBeCloseTo(40, 5); // 3000 + 1000 = 4000 / 10000
  });

  it("propagates excludedCount from position valuation without altering the math", () => {
    const positions: ValuedPosition[] = [{ instrumentId: "i-stock", quantity: 10, baseValue: 5000n }];
    const targets = [target(AC_STOCKS, 100)];
    const result = computeRebalance({
      dimension: "asset_class",
      valuedPositions: positions,
      totalValue: 5000n,
      excludedCount: 3,
      instrumentById,
      assetClassById,
      targets,
      baseCurrency: "USD",
    });
    expect(result.excludedCount).toBe(3);
  });

  it("falls back to UNASSIGNED_KEY for an instrument without asset class in the asset_class dimension", () => {
    const noClassInstrument = new Map<string, ValuationInstrument>([["i-x", { id: "i-x", currencyCode: "USD", assetClassId: null }]]);
    const positions: ValuedPosition[] = [{ instrumentId: "i-x", quantity: 10, baseValue: 1000n }];
    const targets = [target(UNASSIGNED_KEY, 100)];
    const result = computeRebalance({
      dimension: "asset_class",
      valuedPositions: positions,
      totalValue: 1000n,
      excludedCount: 0,
      instrumentById: noClassInstrument,
      assetClassById,
      targets,
      baseCurrency: "USD",
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.key).toBe(UNASSIGNED_KEY);
    expect(result.rows[0]!.actualPct).toBe(100);
  });
});
