import { afterEach, describe, expect, it } from "vitest";
import { generateEvenSchedule } from "./installment-schedule";

describe("generateEvenSchedule", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

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

  it("no pierde un día en husos negativos (medianoche UTC cae en el día anterior)", () => {
    process.env.TZ = "America/Montevideo"; // UTC-3
    const schedule = generateEvenSchedule(300n, 3, new Date(2026, 0, 15));
    expect(schedule.map((s) => s.dueDate)).toEqual(["2026-02-15", "2026-03-15", "2026-04-15"]);
  });

  it("clampea al último día del mes destino cuando el mes de arranque no existe ahí (31 → 28/29/30)", () => {
    // Cuota mensual arrancando el 31 de enero: febrero no tiene 31, y `new
    // Date(y, 1, 31)` sin clamp desborda en silencio al 3 de marzo.
    const schedule = generateEvenSchedule(400n, 4, new Date(2026, 0, 31));
    expect(schedule.map((s) => s.dueDate)).toEqual([
      "2026-02-28", // 2026 no es bisiesto
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
    ]);
  });

  it("clampea al 29 de febrero en año bisiesto", () => {
    const schedule = generateEvenSchedule(100n, 1, new Date(2028, 0, 31));
    expect(schedule[0]!.dueDate).toBe("2028-02-29"); // 2028 es bisiesto
  });
});
