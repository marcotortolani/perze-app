import { describe, expect, it } from "vitest";
import { averageDailyExpense, summarizePeriod } from "./period-summary";

const from = new Date(2026, 6, 1);
const to = new Date(2026, 7, 1);

describe("summarizePeriod", () => {
  it("sums expenses and income within the range, ignoring transfers", () => {
    const result = summarizePeriod(
      [
        { kind: "expense", amountBase: 1000n, occurredAt: "2026-07-10" },
        { kind: "expense", amountBase: 500n, occurredAt: "2026-07-15" },
        { kind: "income", amountBase: 5000n, occurredAt: "2026-07-05" },
        { kind: "transfer", amountBase: 9999n, occurredAt: "2026-07-05" },
        { kind: "expense", amountBase: 100n, occurredAt: "2026-06-30" }, // outside range
      ],
      from,
      to
    );
    expect(result.expenseTotal).toBe(1500n);
    expect(result.incomeTotal).toBe(5000n);
    expect(result.cashflow).toBe(3500n);
    expect(result.savingsRatePct).toBeCloseTo(70);
    expect(result.excludedCount).toBe(0);
  });

  it("excludes needs_fx transactions (amountBase null) from every total, and counts them", () => {
    const result = summarizePeriod(
      [
        { kind: "expense", amountBase: 1000n, occurredAt: "2026-07-10" },
        { kind: "expense", amountBase: null, occurredAt: "2026-07-11" },
      ],
      from,
      to
    );
    expect(result.expenseTotal).toBe(1000n);
    expect(result.excludedCount).toBe(1);
  });

  it("returns null savings rate with no income", () => {
    const result = summarizePeriod([{ kind: "expense", amountBase: 500n, occurredAt: "2026-07-10" }], from, to);
    expect(result.savingsRatePct).toBeNull();
  });
});

describe("averageDailyExpense", () => {
  it("divides by the number of days", () => {
    expect(averageDailyExpense(3000n, 30)).toBe(100n);
  });

  it("returns 0 for a zero-day range", () => {
    expect(averageDailyExpense(3000n, 0)).toBe(0n);
  });
});
