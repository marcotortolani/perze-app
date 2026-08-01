import { describe, expect, it } from "vitest";
import { generateEvenSchedule } from "./installment-schedule";

describe("generateEvenSchedule", () => {
  it("divides the principal evenly across installments", () => {
    const schedule = generateEvenSchedule(1200n, 12, new Date(2026, 0, 15));
    expect(schedule).toHaveLength(12);
    expect(schedule.every((s) => s.principalAmount === 100n)).toBe(true);
    expect(schedule[0]!.dueDate).toBe("2026-02-15");
    expect(schedule[11]!.dueDate).toBe("2027-01-15");
  });

  it("puts the rounding remainder on the last installment so the total matches exactly", () => {
    const schedule = generateEvenSchedule(1000n, 3, new Date(2026, 0, 1));
    const total = schedule.reduce((s, i) => s + i.principalAmount, 0n);
    expect(total).toBe(1000n);
    expect(schedule[0]!.principalAmount).toBe(333n);
    expect(schedule[2]!.principalAmount).toBe(334n);
  });

  it("returns an empty schedule for zero or negative installments", () => {
    expect(generateEvenSchedule(1000n, 0, new Date())).toEqual([]);
  });
});
