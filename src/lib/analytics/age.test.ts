import { describe, expect, it } from "vitest";
import { ageFromBirthDate, birthDateFromAge, isBirthdayToday } from "./age";

describe("birthDateFromAge", () => {
  it("round-trips antes del 1 de julio: el cumpleaños sintético de este año todavía no pasó", () => {
    const now = new Date(2026, 2, 10); // 10 de marzo de 2026
    const birthDate = birthDateFromAge(30, now);
    expect(birthDate).toBe("1995-07-01");
    expect(ageFromBirthDate(birthDate, now)).toBe(30);
  });

  it("round-trips después del 1 de julio: el cumpleaños sintético de este año ya pasó", () => {
    const now = new Date(2026, 8, 10); // 10 de setiembre de 2026
    const birthDate = birthDateFromAge(30, now);
    expect(birthDate).toBe("1996-07-01");
    expect(ageFromBirthDate(birthDate, now)).toBe(30);
  });

  it("round-trips exactamente el 1 de julio", () => {
    const now = new Date(2026, 6, 1); // 1 de julio de 2026
    const birthDate = birthDateFromAge(30, now);
    expect(ageFromBirthDate(birthDate, now)).toBe(30);
  });

  it("funciona para varias edades sobre la misma fecha de referencia", () => {
    const now = new Date(2026, 2, 10);
    for (const age of [0, 1, 17, 45, 90]) {
      expect(ageFromBirthDate(birthDateFromAge(age, now), now)).toBe(age);
    }
  });
});

describe("isBirthdayToday con precisión", () => {
  it("nunca es true con precisión 'year', aunque el día coincida", () => {
    const now = new Date(2026, 6, 1); // 1 de julio — el día sintético
    expect(isBirthdayToday("1995-07-01", "year", now)).toBe(false);
  });

  it("es true con precisión 'exact' cuando el día coincide", () => {
    const now = new Date(2026, 6, 1);
    expect(isBirthdayToday("1995-07-01", "exact", now)).toBe(true);
  });

  it("es true con precisión null cuando el día coincide (fechas cargadas antes de esta migración)", () => {
    const now = new Date(2026, 6, 1);
    expect(isBirthdayToday("1995-07-01", null, now)).toBe(true);
  });

  it("es false cuando el día no coincide, sea cual sea la precisión", () => {
    const now = new Date(2026, 6, 2);
    expect(isBirthdayToday("1995-07-01", "exact", now)).toBe(false);
    expect(isBirthdayToday("1995-07-01", null, now)).toBe(false);
  });
});
