import { describe, expect, it } from "vitest";
import { closedPeriodsCount, currentPeriodBounds, daysOfHistory, daysUntilPeriodCloses, monthsOfHistory, periodBoundsAt, previousClosedPeriodBounds } from "./history";

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

describe("periodBoundsAt", () => {
  it("offset 0 matches currentPeriodBounds", () => {
    const now = new Date(2026, 6, 20);
    expect(periodBoundsAt(1, now, 0)).toEqual(currentPeriodBounds(1, now));
  });

  it("offset -1 matches previousClosedPeriodBounds", () => {
    const now = new Date(2026, 6, 20);
    expect(periodBoundsAt(1, now, -1)).toEqual(previousClosedPeriodBounds(1, now));
  });

  it("walks N periods back with a non-1st start day", () => {
    // 20/jul < 25 → el período en curso es 25/jun-25/jul, no 25/jul-25/ago.
    const now = new Date(2026, 6, 20);
    expect(periodBoundsAt(25, now, -2)).toEqual({ start: new Date(2026, 3, 25), end: new Date(2026, 4, 25) });
  });

  it("offset positivo mira hacia adelante", () => {
    const now = new Date(2026, 6, 20);
    expect(periodBoundsAt(1, now, 1)).toEqual({ start: new Date(2026, 7, 1), end: new Date(2026, 8, 1) });
  });
});

describe("periodStart clamping (espejo de household_period_start en Postgres)", () => {
  // periodStartDay > 28 no es seleccionable hoy (`CLOSE_DAYS` en /more/settings va de 1 a 28),
  // pero la función tiene que clampear igual para no divergir en silencio del servidor si esa
  // lista se amplía — es la misma garantía que ya tiene `household_period_start()`.
  it("clamps a 31 start day to the last day of a short month", () => {
    // Febrero 2026 tiene 28 días: el 27/feb todavía no llegó al cierre clampeado (28),
    // así que el período en curso arrancó el 31 de enero.
    expect(closedPeriodsCount("2026-01-31T12:00:00.000Z", 31, new Date(2026, 1, 27))).toBe(0);
    // El 28/feb (el día clampeado) ya es el propio arranque del período de febrero.
    expect(closedPeriodsCount("2026-01-31T12:00:00.000Z", 31, new Date(2026, 1, 28))).toBe(1);
  });
});
