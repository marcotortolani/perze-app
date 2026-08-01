import { describe, expect, it } from "vitest";
import { computeXirr } from "./xirr";

describe("computeXirr", () => {
  it("computes ~10% annualized return for a one-year round trip", () => {
    const flows = [
      { date: new Date(2025, 0, 1), amount: -1000 },
      { date: new Date(2026, 0, 1), amount: 1100 },
    ];
    const rate = computeXirr(flows);
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(0.1, 2);
  });

  it("handles multiple irregular cash flows", () => {
    const flows = [
      { date: new Date(2025, 0, 1), amount: -1000 },
      { date: new Date(2025, 5, 1), amount: -500 },
      { date: new Date(2026, 0, 1), amount: 1700 },
    ];
    const rate = computeXirr(flows);
    expect(rate).not.toBeNull();
    expect(rate!).toBeGreaterThan(0);
  });

  it("returns null with fewer than 2 flows", () => {
    expect(computeXirr([{ date: new Date(), amount: -100 }])).toBeNull();
  });

  it("returns null when all flows have the same sign", () => {
    const flows = [
      { date: new Date(2025, 0, 1), amount: -1000 },
      { date: new Date(2025, 6, 1), amount: -500 },
    ];
    expect(computeXirr(flows)).toBeNull();
  });
});
