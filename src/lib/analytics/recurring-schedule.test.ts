import { describe, expect, it } from "vitest";
import { computeMonthlyCommitted, computeUpcomingCharges, nextOccurrence } from "./recurring-schedule";

describe("nextOccurrence", () => {
  it("returns this month's date when the day hasn't passed yet", () => {
    const now = new Date(2026, 6, 10); // July 10
    expect(nextOccurrence(15, now)).toEqual(new Date(2026, 6, 15));
  });

  it("rolls over to next month when the day already passed", () => {
    const now = new Date(2026, 6, 20);
    expect(nextOccurrence(15, now)).toEqual(new Date(2026, 7, 15));
  });

  it("returns today when the day is today", () => {
    const now = new Date(2026, 6, 15);
    expect(nextOccurrence(15, now)).toEqual(new Date(2026, 6, 15));
  });

  it("clamps day 31 to the last day of a shorter month", () => {
    const now = new Date(2026, 1, 20); // Feb 20 2026 (28 days)
    expect(nextOccurrence(31, now)).toEqual(new Date(2026, 1, 28));
  });

  it("rolls to the full day 31 of the next month once the clamped day has passed", () => {
    const now = new Date(2026, 2, 1); // March 1 — Feb's clamped occurrence (Feb 28) already happened
    expect(nextOccurrence(31, now)).toEqual(new Date(2026, 2, 31));
  });
});

describe("computeUpcomingCharges", () => {
  it("includes charges within the horizon, sorted by date", () => {
    const now = new Date(2026, 6, 10);
    const rules = [
      { id: "a", kind: "expense" as const, expectedAmount: 100n, dayOfMonth: 25 },
      { id: "b", kind: "expense" as const, expectedAmount: 100n, dayOfMonth: 12 },
    ];
    const result = computeUpcomingCharges(rules, now, 30);
    expect(result.map((c) => c.ruleId)).toEqual(["b", "a"]);
  });

  it("excludes charges beyond the horizon", () => {
    const now = new Date(2026, 6, 1);
    const rules = [{ id: "a", kind: "expense" as const, expectedAmount: 100n, dayOfMonth: 28 }];
    expect(computeUpcomingCharges(rules, now, 7)).toEqual([]);
  });
});

describe("computeMonthlyCommitted", () => {
  it("sums only expense rules", () => {
    const rules = [
      { id: "a", kind: "expense" as const, expectedAmount: 100n, dayOfMonth: 1 },
      { id: "b", kind: "income" as const, expectedAmount: 5000n, dayOfMonth: 1 },
    ];
    expect(computeMonthlyCommitted(rules)).toBe(100n);
  });
});
