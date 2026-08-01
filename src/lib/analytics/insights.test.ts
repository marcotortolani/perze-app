import { describe, expect, it } from "vitest";
import { computeBudgetPaceInsights, computeLoggingStreak } from "./insights";

describe("computeLoggingStreak", () => {
  it("counts consecutive days ending today", () => {
    const now = new Date(2026, 6, 31);
    const txs = [
      { occurredAt: new Date(2026, 6, 31).toISOString() },
      { occurredAt: new Date(2026, 6, 30).toISOString() },
      { occurredAt: new Date(2026, 6, 29).toISOString() },
    ];
    expect(computeLoggingStreak(txs, now)).toBe(3);
  });

  it("stops at the first missing day going backwards", () => {
    const now = new Date(2026, 6, 31);
    const txs = [{ occurredAt: new Date(2026, 6, 31).toISOString() }, { occurredAt: new Date(2026, 6, 29).toISOString() }];
    expect(computeLoggingStreak(txs, now)).toBe(1);
  });

  it("returns 0 when nothing was logged today", () => {
    const now = new Date(2026, 6, 31);
    const txs = [{ occurredAt: new Date(2026, 6, 30).toISOString() }];
    expect(computeLoggingStreak(txs, now)).toBe(0);
  });
});

describe("computeBudgetPaceInsights", () => {
  it("projects an overspend date when the current pace exceeds the limit before period end", () => {
    const periodStart = new Date(2026, 6, 1);
    const periodEnd = new Date(2026, 7, 1);
    const now = new Date(2026, 6, 10); // 9 days elapsed
    const budgets = [{ categoryId: "food", amountLimit: 3000n, spent: 2000n }]; // 222/day → hits 3000 at day ~13.5
    const result = computeBudgetPaceInsights(budgets, periodStart, periodEnd, now);
    expect(result).toHaveLength(1);
    expect(result[0]!.categoryId).toBe("food");
    expect(result[0]!.projectedOverspendDate.getDate()).toBeGreaterThan(10);
  });

  it("does not flag a budget on pace to stay under the limit", () => {
    const periodStart = new Date(2026, 6, 1);
    const periodEnd = new Date(2026, 7, 1);
    const now = new Date(2026, 6, 10);
    const budgets = [{ categoryId: "food", amountLimit: 10000n, spent: 100n }];
    expect(computeBudgetPaceInsights(budgets, periodStart, periodEnd, now)).toEqual([]);
  });

  it("ignores a projected date that falls after the period closes", () => {
    const periodStart = new Date(2026, 6, 1);
    const periodEnd = new Date(2026, 6, 5);
    const now = new Date(2026, 6, 2);
    const budgets = [{ categoryId: "food", amountLimit: 100000n, spent: 10n }];
    expect(computeBudgetPaceInsights(budgets, periodStart, periodEnd, now)).toEqual([]);
  });
});
