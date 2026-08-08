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

  it("counts a buy as outflow and a sell as inflow, without touching expenseTotal/incomeTotal", () => {
    const result = summarizePeriod(
      [
        { kind: "income", amountBase: 3000n, occurredAt: "2026-07-05" },
        { kind: "investing", amountBase: -800n, occurredAt: "2026-07-10" }, // compra
        { kind: "investing", amountBase: 200n, occurredAt: "2026-07-15" }, // venta
      ],
      from,
      to
    );
    // regresión: una compra ya no puede caer en el `else` y restar de los ingresos
    expect(result.incomeTotal).toBe(3000n);
    expect(result.expenseTotal).toBe(0n);
    expect(result.outflowTotal).toBe(800n);
    expect(result.inflowTotal).toBe(3200n);
    expect(result.cashflow).toBe(2400n);
  });

  it("no cuenta el placeholder needs_capture_fx (amountBase 0n) como flujo ni como excluido", () => {
    const result = summarizePeriod([{ kind: "investing", amountBase: 0n, occurredAt: "2026-07-10" }], from, to);
    expect(result.inflowTotal).toBe(0n);
    expect(result.outflowTotal).toBe(0n);
    expect(result.excludedCount).toBe(0);
  });

  it("excludes a needs_fx investing row from cashflow and counts it once, not twice", () => {
    const result = summarizePeriod([{ kind: "investing", amountBase: null, occurredAt: "2026-07-10" }], from, to);
    expect(result.excludedCount).toBe(1);
    expect(result.inflowTotal).toBe(0n);
    expect(result.outflowTotal).toBe(0n);
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
