import { describe, expect, it } from "vitest";
import { isChargeDue, monthlyEquivalent, nextOccurrenceAfter, occurredAtFor, occurrencesBetween, occurrencesPerYear, type OccurrenceRule } from "./occurrences";
import vectors from "./__fixtures__/occurrence-vectors.json";

describe("occurrencesBetween — vectores compartidos con el espejo SQL", () => {
  for (const v of vectors as Array<{ name: string; frequency: OccurrenceRule["frequency"]; anchorDate: string; dayOfMonth: number | null; endDate: string | null; from: string; to: string; expected: string[] }>) {
    it(v.name, () => {
      const rule: OccurrenceRule = { frequency: v.frequency, anchorDate: v.anchorDate, dayOfMonth: v.dayOfMonth, endDate: v.endDate };
      expect(occurrencesBetween(rule, v.from, v.to)).toEqual(v.expected);
    });
  }
});

describe("occurrencesBetween — casos adicionales", () => {
  it("nunca devuelve nada antes de anchorDate aunque el rango empiece antes", () => {
    const rule: OccurrenceRule = { frequency: "monthly", anchorDate: "2026-03-10", dayOfMonth: 10, endDate: null };
    const result = occurrencesBetween(rule, "2025-01-01", "2026-06-30");
    expect(result.every((d) => d >= "2026-03-10")).toBe(true);
    expect(result).toEqual(["2026-03-10", "2026-04-10", "2026-05-10", "2026-06-10"]);
  });

  it("weekly cruzando un cambio de horario de Sao Paulo (fin de DST en 2026 ya no existe, pero el cálculo es agnóstico de TZ igual)", () => {
    const rule: OccurrenceRule = { frequency: "weekly", anchorDate: "2026-11-01", dayOfMonth: null, endDate: null };
    const a = occurrencesBetween(rule, "2026-11-08", "2026-12-06");
    expect(a).toEqual(["2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29", "2026-12-06"]);
  });
});

describe("nextOccurrenceAfter", () => {
  it("devuelve la próxima ocurrencia estricta después de una fecha", () => {
    const rule: OccurrenceRule = { frequency: "monthly", anchorDate: "2026-01-01", dayOfMonth: 1, endDate: null };
    expect(nextOccurrenceAfter(rule, "2026-01-01")).toBe("2026-02-01");
  });

  it("null cuando la regla ya terminó", () => {
    const rule: OccurrenceRule = { frequency: "monthly", anchorDate: "2026-01-01", dayOfMonth: 1, endDate: "2026-01-01" };
    expect(nextOccurrenceAfter(rule, "2026-01-01")).toBeNull();
  });
});

describe("occurredAtFor", () => {
  it("mediodía UTC exacto", () => {
    expect(occurredAtFor("2026-07-04")).toBe("2026-07-04T12:00:00.000Z");
  });
});

describe("monthlyEquivalent / occurrencesPerYear", () => {
  it("mensual es identidad", () => {
    expect(monthlyEquivalent(1200n, "monthly")).toBe(1200n);
  });
  it("anual se divide por 12", () => {
    expect(monthlyEquivalent(1200n, "yearly")).toBe(100n);
  });
  it("semanal y quincenal usan 52/26 ocurrencias por año", () => {
    expect(occurrencesPerYear("weekly")).toBe(52);
    expect(occurrencesPerYear("biweekly")).toBe(26);
    expect(monthlyEquivalent(1000n, "weekly")).toBe((1000n * 52n) / 12n);
  });
});

describe("isChargeDue — cuándo se ofrece 'Cargar ahora'", () => {
  it("vencido: debido", () => {
    expect(isChargeDue(false, "2026-08-01", "2026-08-08")).toBe(true);
  });

  it("vence hoy: debido", () => {
    expect(isChargeDue(false, "2026-08-08", "2026-08-08")).toBe(true);
  });

  it("todavía no llegó: NO debido, aunque falte un solo día", () => {
    expect(isChargeDue(false, "2026-08-09", "2026-08-08")).toBe(false);
  });

  it("sin ningún período pendiente (regla terminada): NO debido", () => {
    expect(isChargeDue(false, null, "2026-08-08")).toBe(false);
  });

  it("auto-registro ON: nunca debido, aunque haya algo vencido", () => {
    expect(isChargeDue(true, "2026-08-01", "2026-08-08")).toBe(false);
  });
});
