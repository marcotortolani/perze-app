import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { todayIso } from "./today";

/**
 * D10 — `new Date().toISOString().slice(0, 10)` toma el día en UTC: para un
 * usuario en UTC−3 (Montevideo/Buenos Aires), un gasto cargado entre las
 * 21:00 y las 00:00 local queda fechado "mañana". Este test fija el reloj
 * del sistema a un instante que ya cruzó la medianoche UTC pero sigue
 * siendo el día anterior en hora local, y verifica que `todayIso` devuelve
 * el día calendario correcto — no el de UTC.
 */
describe("todayIso (D10)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("23:00 en UTC−3 sigue siendo el día local, aunque en UTC ya sea mañana", () => {
    // 2026-08-02T01:30:00Z = 2026-08-01T22:30:00 en UTC−3 (Montevideo).
    vi.setSystemTime(new Date("2026-08-02T01:30:00.000Z"));

    // El bug original: new Date().toISOString().slice(0, 10) da "2026-08-02".
    expect(new Date().toISOString().slice(0, 10)).toBe("2026-08-02");

    // El fix: el día calendario local sigue siendo el 1.
    expect(todayIso("America/Montevideo")).toBe("2026-08-01");
  });

  it("a media mañana en UTC−3, coincide con el día UTC (no hay bug para ocultar)", () => {
    vi.setSystemTime(new Date("2026-08-01T14:00:00.000Z"));
    expect(todayIso("America/Montevideo")).toBe("2026-08-01");
  });

  it("sin timeZone explícito, usa la zona del entorno (Intl.DateTimeFormat().resolvedOptions())", () => {
    vi.setSystemTime(new Date("2026-08-01T14:00:00.000Z"));
    const envTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(todayIso()).toBe(todayIso(envTz));
  });
});
