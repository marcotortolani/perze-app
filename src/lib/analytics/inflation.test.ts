import { describe, expect, it } from "vitest";
import { adjustForInflation, inflationBetween } from "./inflation";

const points = [
  { period: "2026-05", indexValue: 100 },
  { period: "2026-06", indexValue: 105 },
];

describe("adjustForInflation", () => {
  it("reexpresses a past amount in the latest period's prices", () => {
    expect(adjustForInflation(1000n, "2026-05", points)).toBe(1050n); // 1000 * 105/100
  });

  it("leaves the latest period's amount unchanged", () => {
    expect(adjustForInflation(1000n, "2026-06", points)).toBe(1000n);
  });

  it("returns null when the period has no index value", () => {
    expect(adjustForInflation(1000n, "2026-01", points)).toBeNull();
  });

  it("returns null with no index points at all", () => {
    expect(adjustForInflation(1000n, "2026-05", [])).toBeNull();
  });
});

describe("inflationBetween", () => {
  it("computes the percentage change between two periods", () => {
    expect(inflationBetween("2026-05", "2026-06", points)).toBeCloseTo(5);
  });

  it("returns null when a period is missing", () => {
    expect(inflationBetween("2026-01", "2026-06", points)).toBeNull();
  });
});
