import { describe, expect, it } from "vitest";
import { computeContributionRate, computeThreeMonthCushion, projectArrivalDate } from "./goal-projection";

describe("computeContributionRate", () => {
  it("averages the net effect on the account over N months", () => {
    const now = new Date(2026, 6, 1);
    const txs = [
      { kind: "income" as const, amount: 3000n, accountId: "goal-acc", counterAccountId: null, counterAmount: null, occurredAt: new Date(2026, 4, 15).toISOString() },
      { kind: "income" as const, amount: 3000n, accountId: "goal-acc", counterAccountId: null, counterAmount: null, occurredAt: new Date(2026, 5, 15).toISOString() },
    ];
    // 6000 total over 3 months = 2000/month
    expect(computeContributionRate(txs, "goal-acc", now, 3)).toBe(2000n);
  });

  it("ignores transactions on other accounts", () => {
    const now = new Date(2026, 6, 1);
    const txs = [{ kind: "income" as const, amount: 3000n, accountId: "other-acc", counterAccountId: null, counterAmount: null, occurredAt: new Date(2026, 5, 15).toISOString() }];
    expect(computeContributionRate(txs, "goal-acc", now, 3)).toBe(0n);
  });

  it("counts an expense as a negative contribution", () => {
    const now = new Date(2026, 6, 1);
    const txs = [{ kind: "expense" as const, amount: 900n, accountId: "goal-acc", counterAccountId: null, counterAmount: null, occurredAt: new Date(2026, 5, 15).toISOString() }];
    expect(computeContributionRate(txs, "goal-acc", now, 3)).toBe(-300n);
  });
});

describe("projectArrivalDate", () => {
  it("projects a future month given the monthly rate", () => {
    const now = new Date(2026, 6, 1);
    const result = projectArrivalDate(1000n, 4000n, 1000n, now); // 3000 remaining at 1000/month = 3 months
    expect(result).toEqual(new Date(2026, 9, 1));
  });

  it("returns now when the target is already reached", () => {
    const now = new Date(2026, 6, 1);
    expect(projectArrivalDate(5000n, 4000n, 1000n, now)).toEqual(now);
  });

  it("returns null when the rate is zero or negative", () => {
    const now = new Date(2026, 6, 1);
    expect(projectArrivalDate(1000n, 4000n, 0n, now)).toBeNull();
    expect(projectArrivalDate(1000n, 4000n, -100n, now)).toBeNull();
  });
});

describe("computeThreeMonthCushion", () => {
  it("computes 3x the 90-day average daily expense", () => {
    const now = new Date(2026, 6, 1);
    const start = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
    const txs = [{ kind: "expense" as const, amountBase: 9000n, occurredAt: start.toISOString() }];
    // 9000 over 90 days = 100/day; cushion = 100 * 90 = 9000
    expect(computeThreeMonthCushion(txs, now)).toBe(9000n);
  });

  it("excludes needs_fx transactions from the average", () => {
    const now = new Date(2026, 6, 1);
    const txs = [{ kind: "expense" as const, amountBase: null, occurredAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString() }];
    expect(computeThreeMonthCushion(txs, now)).toBe(0n);
  });
});
