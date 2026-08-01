import { describe, expect, it } from "vitest";
import { closedPeriodsCount, daysOfHistory, daysUntilPeriodCloses, monthsOfHistory } from "./history";

describe("daysOfHistory", () => {
  it("returns 0 with no transactions", () => {
    expect(daysOfHistory(undefined, new Date("2026-07-31"))).toBe(0);
  });

  it("counts full days since the first transaction", () => {
    expect(daysOfHistory("2026-07-01T00:00:00.000Z", new Date("2026-07-31T00:00:00.000Z"))).toBe(30);
  });
});

describe("monthsOfHistory", () => {
  it("counts full calendar months", () => {
    expect(monthsOfHistory("2026-05-15T00:00:00.000Z", new Date("2026-07-20T00:00:00.000Z"))).toBe(2);
  });

  it("doesn't count a partial month", () => {
    expect(monthsOfHistory("2026-05-15T00:00:00.000Z", new Date("2026-07-10T00:00:00.000Z"))).toBe(1);
  });
});

describe("closedPeriodsCount", () => {
  it("is 0 during the first period", () => {
    expect(closedPeriodsCount("2026-07-05T00:00:00.000Z", 1, new Date("2026-07-20T00:00:00.000Z"))).toBe(0);
  });

  it("counts one closed period after it rolls over", () => {
    expect(closedPeriodsCount("2026-06-05T00:00:00.000Z", 1, new Date("2026-07-20T00:00:00.000Z"))).toBe(1);
  });

  it("respects a non-1st period start day", () => {
    // First transaction on 2026-06-20 belongs to the May25-June25 period.
    // On 2026-06-24 we're still in that same (not-yet-closed) period.
    expect(closedPeriodsCount("2026-06-20", 25, new Date(2026, 5, 24))).toBe(0);
    // By 2026-07-20 the May25-June25 period has fully closed — one period down.
    expect(closedPeriodsCount("2026-06-20", 25, new Date(2026, 6, 20))).toBe(1);
  });
});

describe("daysUntilPeriodCloses", () => {
  it("counts down to the next close day", () => {
    expect(daysUntilPeriodCloses(25, new Date(2026, 6, 20))).toBe(5);
  });
});
