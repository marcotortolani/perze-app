import { describe, expect, it } from "vitest";
import { computeFutureIncome, type FixedIncomePosition } from "./future-income";

const now = new Date(2026, 0, 1);

describe("computeFutureIncome", () => {
  it("generates periodic coupons up to the horizon", () => {
    const positions: FixedIncomePosition[] = [
      { instrumentId: "b1", symbol: "BOND1", quantity: 100000, currencyCode: "USD", maturityDate: "2030-01-01", couponRate: 12, couponFrequency: 2 },
    ];
    const events = computeFutureIncome(positions, now, 12);
    const coupons = events.filter((e) => e.kind === "coupon");
    expect(coupons).toHaveLength(2); // every 6 months within 12 months
    expect(coupons[0]!.amount).toBe(6000n); // 100000 * 12% / 2
  });

  it("stops generating coupons past maturity", () => {
    const positions: FixedIncomePosition[] = [
      { instrumentId: "b1", symbol: "BOND1", quantity: 100000, currencyCode: "USD", maturityDate: "2026-04-01", couponRate: 12, couponFrequency: 2 },
    ];
    const events = computeFutureIncome(positions, now, 24);
    const coupons = events.filter((e) => e.kind === "coupon");
    expect(coupons).toHaveLength(0); // first coupon at 2026-07 is past maturity
  });

  it("includes a maturity event with the full nominal when maturity falls within the horizon", () => {
    const positions: FixedIncomePosition[] = [
      { instrumentId: "b1", symbol: "BOND1", quantity: 50000, currencyCode: "USD", maturityDate: "2026-06-01", couponRate: 10, couponFrequency: 1 },
    ];
    const events = computeFutureIncome(positions, now, 12);
    const maturity = events.find((e) => e.kind === "maturity");
    expect(maturity?.amount).toBe(50000n);
  });

  it("skips positions without coupon data", () => {
    const positions: FixedIncomePosition[] = [{ instrumentId: "s1", symbol: "AAPL", quantity: 10, currencyCode: "USD", maturityDate: null, couponRate: null, couponFrequency: null }];
    expect(computeFutureIncome(positions, now, 12)).toEqual([]);
  });

  it("sorts events chronologically across multiple instruments", () => {
    const positions: FixedIncomePosition[] = [
      { instrumentId: "b1", symbol: "LATE", quantity: 1000, currencyCode: "USD", maturityDate: "2027-01-01", couponRate: 4, couponFrequency: 1 },
      { instrumentId: "b2", symbol: "EARLY", quantity: 1000, currencyCode: "USD", maturityDate: "2026-03-01", couponRate: 4, couponFrequency: 1 },
    ];
    const events = computeFutureIncome(positions, now, 24);
    expect(events[0]!.symbol).toBe("EARLY");
  });
});
