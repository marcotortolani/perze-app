import { describe, expect, it } from "vitest";
import { computeWrappedSummary, type WrappedTransactionInput } from "./wrapped";

const periodStart = new Date(2026, 0, 1);
const periodEnd = new Date(2026, 6, 1);

describe("computeWrappedSummary", () => {
  it("sums income and expense, excluding needs_fx from the totals but counting them", () => {
    const txs: WrappedTransactionInput[] = [
      { kind: "income", occurredAt: new Date(2026, 1, 1).toISOString(), amountBase: 1000n, payeeId: null },
      { kind: "expense", occurredAt: new Date(2026, 1, 2).toISOString(), amountBase: 400n, payeeId: null },
      { kind: "expense", occurredAt: new Date(2026, 1, 3).toISOString(), amountBase: null, payeeId: null },
    ];
    const result = computeWrappedSummary(txs, periodStart, periodEnd);
    expect(result.totalIncome).toBe(1000n);
    expect(result.totalExpense).toBe(400n);
    expect(result.excludedCount).toBe(1);
    expect(result.transactionCount).toBe(3);
  });

  it("computes savings rate as a percentage of income", () => {
    const txs: WrappedTransactionInput[] = [
      { kind: "income", occurredAt: new Date(2026, 1, 1).toISOString(), amountBase: 1000n, payeeId: null },
      { kind: "expense", occurredAt: new Date(2026, 1, 2).toISOString(), amountBase: 780n, payeeId: null },
    ];
    const result = computeWrappedSummary(txs, periodStart, periodEnd);
    expect(result.savingsRatePct).toBeCloseTo(22);
  });

  it("returns null savings rate with no income", () => {
    const txs: WrappedTransactionInput[] = [{ kind: "expense", occurredAt: new Date(2026, 1, 2).toISOString(), amountBase: 100n, payeeId: null }];
    expect(computeWrappedSummary(txs, periodStart, periodEnd).savingsRatePct).toBeNull();
  });

  it("finds the payee with the most visits", () => {
    const txs: WrappedTransactionInput[] = [
      { kind: "expense", occurredAt: new Date(2026, 1, 1).toISOString(), amountBase: 100n, payeeId: "disco" },
      { kind: "expense", occurredAt: new Date(2026, 1, 2).toISOString(), amountBase: 100n, payeeId: "disco" },
      { kind: "expense", occurredAt: new Date(2026, 1, 3).toISOString(), amountBase: 100n, payeeId: "tienda" },
    ];
    expect(computeWrappedSummary(txs, periodStart, periodEnd).topPayee).toEqual({ payeeId: "disco", visits: 2, total: 200n });
  });

  it("ignores transactions outside the period", () => {
    const txs: WrappedTransactionInput[] = [{ kind: "income", occurredAt: new Date(2025, 0, 1).toISOString(), amountBase: 1000n, payeeId: null }];
    expect(computeWrappedSummary(txs, periodStart, periodEnd).transactionCount).toBe(0);
  });
});
