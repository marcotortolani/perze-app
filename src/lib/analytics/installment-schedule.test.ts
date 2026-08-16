import { describe, expect, it } from "vitest";
import { generateSchedule } from "./installment-schedule";

describe("generateSchedule — none", () => {
  it("divides the principal evenly across installments, sin interés", () => {
    const schedule = generateSchedule("none", { principal: 1200n, installments: 12, startDate: new Date(2026, 0, 15), annualRatePct: null });
    expect(schedule).toHaveLength(12);
    expect(schedule.every((s) => s.principalAmount === 100n)).toBe(true);
    expect(schedule.every((s) => s.interestAmount === 0n)).toBe(true);
    expect(schedule[0]!.dueDate).toBe("2026-02-15");
    expect(schedule[11]!.dueDate).toBe("2027-01-15");
  });

  it("puts the rounding remainder on the last installment so the total matches exactly", () => {
    const schedule = generateSchedule("none", { principal: 1000n, installments: 3, startDate: new Date(2026, 0, 1), annualRatePct: null });
    const total = schedule.reduce((s, i) => s + i.principalAmount, 0n);
    expect(total).toBe(1000n);
    expect(schedule[0]!.principalAmount).toBe(333n);
    expect(schedule[2]!.principalAmount).toBe(334n);
  });

  it("returns an empty schedule for zero or negative installments", () => {
    expect(generateSchedule("none", { principal: 1000n, installments: 0, startDate: new Date(), annualRatePct: null })).toEqual([]);
  });

  it("clamps end-of-month dates instead of overflowing into the next month", () => {
    // 31 de enero + 1 mes → 28 de febrero (2026 no es bisiesto), no 3 de marzo.
    const schedule = generateSchedule("none", { principal: 300n, installments: 2, startDate: new Date(2026, 0, 31), annualRatePct: null });
    expect(schedule[0]!.dueDate).toBe("2026-02-28");
  });
});

describe("generateSchedule — german", () => {
  it("keeps principal constant per installment and the total principal exact", () => {
    const schedule = generateSchedule("german", { principal: 12000n, installments: 12, startDate: new Date(2026, 0, 15), annualRatePct: 24 });
    expect(schedule).toHaveLength(12);
    const totalPrincipal = schedule.reduce((s, i) => s + i.principalAmount, 0n);
    expect(totalPrincipal).toBe(12000n);
    // Capital parejo salvo el resto de la última cuota.
    expect(schedule[0]!.principalAmount).toBe(1000n);
    // El interés decrece cuota a cuota porque el saldo restante decrece.
    expect(schedule[0]!.interestAmount).toBeGreaterThan(schedule[11]!.interestAmount);
    // Primera cuota: interés ≈ 12000 × (24/12/100) = 240.
    expect(schedule[0]!.interestAmount).toBe(240n);
  });

  it("falls back to the even schedule when the rate is zero or absent", () => {
    const schedule = generateSchedule("german", { principal: 1200n, installments: 12, startDate: new Date(2026, 0, 15), annualRatePct: 0 });
    expect(schedule.every((s) => s.interestAmount === 0n)).toBe(true);
    expect(schedule.every((s) => s.principalAmount === 100n)).toBe(true);
  });
});

describe("generateSchedule — french", () => {
  it("keeps the total payment roughly constant and the total principal exact", () => {
    const principal = 12000n;
    const schedule = generateSchedule("french", { principal, installments: 12, startDate: new Date(2026, 0, 15), annualRatePct: 24 });
    expect(schedule).toHaveLength(12);
    const totalPrincipal = schedule.reduce((s, i) => s + i.principalAmount, 0n);
    expect(totalPrincipal).toBe(principal);

    // Cuota total constante dentro de la tolerancia de redondeo (±1 unidad mínima).
    const totals = schedule.map((s) => s.principalAmount + s.interestAmount);
    const firstTotal = totals[0]!;
    for (const total of totals) expect(total >= firstTotal - 1n && total <= firstTotal + 1n).toBe(true);

    // Capital creciente, interés decreciente cuota a cuota — la firma del sistema francés.
    expect(schedule[11]!.principalAmount).toBeGreaterThan(schedule[0]!.principalAmount);
    expect(schedule[0]!.interestAmount).toBeGreaterThan(schedule[11]!.interestAmount);

    // Interés total contra la fórmula cerrada: n × cuota - principal.
    const monthlyRate = 24 / 12 / 100;
    const paymentClosedForm = (Number(principal) * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -12));
    const expectedTotalInterest = paymentClosedForm * 12 - Number(principal);
    const actualTotalInterest = Number(schedule.reduce((s, i) => s + i.interestAmount, 0n));
    expect(Math.abs(actualTotalInterest - expectedTotalInterest)).toBeLessThan(12); // tolerancia: 1 unidad por cuota
  });

  it("falls back to the even schedule when the rate is zero or absent", () => {
    const schedule = generateSchedule("french", { principal: 1200n, installments: 12, startDate: new Date(2026, 0, 15), annualRatePct: null });
    expect(schedule.every((s) => s.interestAmount === 0n)).toBe(true);
    expect(schedule.every((s) => s.principalAmount === 100n)).toBe(true);
  });
});
