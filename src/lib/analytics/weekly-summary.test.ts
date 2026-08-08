import { describe, expect, it } from "vitest";
import { computeWeeklySummary, type WeeklyTransactionInput } from "./weekly-summary";

const weekStart = new Date(2026, 6, 13);
const weekEnd = new Date(2026, 6, 20);
const prevWeekStart = new Date(2026, 6, 6);
const prevWeekEnd = new Date(2026, 6, 13);

describe("computeWeeklySummary", () => {
  it("sums expenses within the week and excludes needs_fx, counting them", () => {
    const txs: WeeklyTransactionInput[] = [
      { kind: "expense", occurredAt: new Date(2026, 6, 14).toISOString(), amountBase: 1000n, payeeId: null, categoryId: null },
      { kind: "expense", occurredAt: new Date(2026, 6, 15).toISOString(), amountBase: null, payeeId: null, categoryId: null },
      { kind: "income", occurredAt: new Date(2026, 6, 14).toISOString(), amountBase: 5000n, payeeId: null, categoryId: null },
    ];
    const result = computeWeeklySummary(txs, weekStart, weekEnd, prevWeekStart, prevWeekEnd);
    expect(result.total).toBe(1000n);
    expect(result.excludedCount).toBe(1);
  });

  it("finds the most expensive day", () => {
    const txs: WeeklyTransactionInput[] = [
      { kind: "expense", occurredAt: new Date(2026, 6, 14).toISOString(), amountBase: 100n, payeeId: null, categoryId: null },
      { kind: "expense", occurredAt: new Date(2026, 6, 18).toISOString(), amountBase: 600n, payeeId: null, categoryId: null },
      { kind: "expense", occurredAt: new Date(2026, 6, 18).toISOString(), amountBase: 200n, payeeId: null, categoryId: null },
    ];
    const result = computeWeeklySummary(txs, weekStart, weekEnd, prevWeekStart, prevWeekEnd);
    expect(result.mostExpensiveDay?.total).toBe(800n);
    expect(result.mostExpensiveDay?.count).toBe(2);
  });

  it("finds the most-visited payee", () => {
    const txs: WeeklyTransactionInput[] = [
      { kind: "expense", occurredAt: new Date(2026, 6, 14).toISOString(), amountBase: 100n, payeeId: "disco", categoryId: null },
      { kind: "expense", occurredAt: new Date(2026, 6, 15).toISOString(), amountBase: 100n, payeeId: "disco", categoryId: null },
      { kind: "expense", occurredAt: new Date(2026, 6, 16).toISOString(), amountBase: 100n, payeeId: "tienda", categoryId: null },
    ];
    const result = computeWeeklySummary(txs, weekStart, weekEnd, prevWeekStart, prevWeekEnd);
    expect(result.topPayee?.payeeId).toBe("disco");
    expect(result.topPayee?.visits).toBe(2);
  });

  it("finds the category with the biggest change vs the previous week", () => {
    const txs: WeeklyTransactionInput[] = [
      { kind: "expense", occurredAt: new Date(2026, 6, 14).toISOString(), amountBase: 2000n, payeeId: null, categoryId: "food" },
      { kind: "expense", occurredAt: new Date(2026, 6, 7).toISOString(), amountBase: 100n, payeeId: null, categoryId: "food" },
    ];
    const result = computeWeeklySummary(txs, weekStart, weekEnd, prevWeekStart, prevWeekEnd);
    expect(result.biggestCategoryChange).toEqual({ categoryId: "food", delta: 1900n });
  });

  it("counts a buy as part of the week's outflow, a sell does not reduce it, and neither pollutes top payee/category", () => {
    const txs: WeeklyTransactionInput[] = [
      { kind: "expense", occurredAt: new Date(2026, 6, 14).toISOString(), amountBase: 1000n, payeeId: "disco", categoryId: "food" },
      { kind: "investing", occurredAt: new Date(2026, 6, 15).toISOString(), amountBase: -800n, payeeId: null, categoryId: null },
      { kind: "investing", occurredAt: new Date(2026, 6, 16).toISOString(), amountBase: 300n, payeeId: null, categoryId: null },
    ];
    const result = computeWeeklySummary(txs, weekStart, weekEnd, prevWeekStart, prevWeekEnd);
    expect(result.total).toBe(1800n);
    expect(result.topPayee?.payeeId).toBe("disco");
    // el delta de categoría es solo del gasto real de "food" — las filas de
    // inversión tienen categoryId null y caen en "__none", que se ignora.
    expect(result.biggestCategoryChange).toEqual({ categoryId: "food", delta: 1000n });
  });
});
