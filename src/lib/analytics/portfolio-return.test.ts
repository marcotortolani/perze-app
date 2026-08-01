import { describe, expect, it } from "vitest";
import { computePortfolioReturn } from "./portfolio-return";

describe("computePortfolioReturn", () => {
  it("treats a buy as an outflow and current value as the closing inflow", () => {
    const now = new Date(2026, 0, 1);
    const trades = [{ kind: "buy" as const, executedAt: new Date(2025, 0, 1).toISOString(), amountBase: 1000n }];
    const result = computePortfolioReturn(trades, 1100n, now);
    expect(result.xirr).not.toBeNull();
    expect(result.xirr!).toBeCloseTo(0.1, 2);
    expect(result.flowCount).toBe(2);
  });

  it("excludes needs_fx trades and counts them", () => {
    const now = new Date(2026, 0, 1);
    const trades = [
      { kind: "buy" as const, executedAt: new Date(2025, 0, 1).toISOString(), amountBase: 1000n },
      { kind: "dividend" as const, executedAt: new Date(2025, 5, 1).toISOString(), amountBase: null },
    ];
    const result = computePortfolioReturn(trades, 1100n, now);
    expect(result.excludedCount).toBe(1);
  });

  it("ignores kinds that don't move cash", () => {
    const now = new Date(2026, 0, 1);
    const trades = [{ kind: "split" as const, executedAt: new Date(2025, 0, 1).toISOString(), amountBase: 0n }];
    const result = computePortfolioReturn(trades, 0n, now);
    expect(result.flowCount).toBe(0);
    expect(result.xirr).toBeNull();
  });

  it("returns null xirr with a single trade and no current value", () => {
    const now = new Date(2026, 0, 1);
    const trades = [{ kind: "buy" as const, executedAt: new Date(2025, 0, 1).toISOString(), amountBase: 1000n }];
    const result = computePortfolioReturn(trades, 0n, now);
    expect(result.xirr).toBeNull();
  });
});
