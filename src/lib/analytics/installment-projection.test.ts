import { describe, expect, it } from "vitest";
import { computeInstallmentProjection, type InstallmentScheduleInput } from "./installment-projection";

const now = new Date(2026, 6, 1); // July 2026

describe("computeInstallmentProjection", () => {
  it("sums only pending installments into totalCommitted", () => {
    const schedule: InstallmentScheduleInput[] = [
      { debtId: "d1", dueDate: "2026-06-01", principalAmount: 1000n, interestAmount: 0n, paidAt: "2026-06-01" },
      { debtId: "d1", dueDate: "2026-07-01", principalAmount: 1000n, interestAmount: 100n, paidAt: null },
      { debtId: "d1", dueDate: "2026-08-01", principalAmount: 1000n, interestAmount: 100n, paidAt: null },
    ];
    const result = computeInstallmentProjection(schedule, now, 3);
    expect(result.totalCommitted).toBe(2200n);
  });

  it("groups plans by debt with remaining, monthly amount, and installments left", () => {
    const schedule: InstallmentScheduleInput[] = [
      { debtId: "d1", dueDate: "2026-07-01", principalAmount: 500n, interestAmount: 0n, paidAt: null },
      { debtId: "d1", dueDate: "2026-08-01", principalAmount: 500n, interestAmount: 0n, paidAt: null },
      { debtId: "d2", dueDate: "2026-07-01", principalAmount: 300n, interestAmount: 20n, paidAt: null },
    ];
    const result = computeInstallmentProjection(schedule, now, 2);
    const d1 = result.plans.find((p) => p.debtId === "d1")!;
    expect(d1.remaining).toBe(1000n);
    expect(d1.monthlyAmount).toBe(500n);
    expect(d1.installmentsLeft).toBe(2);
    const d2 = result.plans.find((p) => p.debtId === "d2")!;
    expect(d2.monthlyAmount).toBe(320n);
  });

  it("buckets pending amounts into month bars starting from now", () => {
    const schedule: InstallmentScheduleInput[] = [
      { debtId: "d1", dueDate: "2026-07-15", principalAmount: 100n, interestAmount: 0n, paidAt: null },
      { debtId: "d1", dueDate: "2026-08-15", principalAmount: 200n, interestAmount: 0n, paidAt: null },
      { debtId: "d1", dueDate: "2026-09-15", principalAmount: 300n, interestAmount: 0n, paidAt: null },
    ];
    const result = computeInstallmentProjection(schedule, now, 3);
    expect(result.monthBars).toEqual([
      { month: "2026-07", amount: 100n },
      { month: "2026-08", amount: 200n },
      { month: "2026-09", amount: 300n },
    ]);
  });

  it("finds the last due date across pending installments only", () => {
    const schedule: InstallmentScheduleInput[] = [
      { debtId: "d1", dueDate: "2026-12-01", principalAmount: 100n, interestAmount: 0n, paidAt: "2026-12-01" },
      { debtId: "d1", dueDate: "2026-09-01", principalAmount: 100n, interestAmount: 0n, paidAt: null },
    ];
    expect(computeInstallmentProjection(schedule, now, 1).lastDueDate).toBe("2026-09-01");
  });

  it("returns null lastDueDate and empty plans when nothing is pending", () => {
    const result = computeInstallmentProjection([], now, 3);
    expect(result.lastDueDate).toBeNull();
    expect(result.plans).toEqual([]);
    expect(result.totalCommitted).toBe(0n);
  });
});
