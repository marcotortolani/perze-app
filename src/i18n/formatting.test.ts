import { describe, expect, it } from "vitest";
import { decimalSeparatorForLocale, formatNumericDate, formatRelativeDay, formatTimeOfDay } from "./formatting";
import { useFormatPreferencesStore } from "@/stores/format-preferences-store";

const SAMPLE_DATE = new Date(2026, 7, 2); // 2 de agosto de 2026 (mes 0-indexado)
const SAMPLE_DATETIME = new Date(2026, 7, 6, 13, 44); // 6 de agosto de 2026, 13:44

describe("formatNumericDate", () => {
  it("dmy/mdy/ymd son fijos, sin importar el idioma de la UI", () => {
    expect(formatNumericDate("es", SAMPLE_DATE, "dmy")).toBe("02/08/2026");
    expect(formatNumericDate("en", SAMPLE_DATE, "dmy")).toBe("02/08/2026");
    expect(formatNumericDate("es", SAMPLE_DATE, "mdy")).toBe("08/02/2026");
    expect(formatNumericDate("es", SAMPLE_DATE, "ymd")).toBe("2026-08-02");
  });

  it("'locale' cae al formato default de Intl para ese idioma", () => {
    expect(formatNumericDate("es", SAMPLE_DATE, "locale")).toBe(new Intl.DateTimeFormat("es").format(SAMPLE_DATE));
  });

  it("sin `pref` explícito, default a 'locale'", () => {
    expect(formatNumericDate("en", SAMPLE_DATE)).toBe(new Intl.DateTimeFormat("en").format(SAMPLE_DATE));
  });
});

describe("formatTimeOfDay", () => {
  it("D34 — deriva del locale vía Intl, nunca getHours()/getMinutes() a mano", () => {
    expect(formatTimeOfDay("es", SAMPLE_DATETIME)).toBe(new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" }).format(SAMPLE_DATETIME));
  });
});

describe("formatRelativeDay", () => {
  const NOW = new Date(2026, 7, 15, 10, 0); // 15 de agosto de 2026, 10:00 local

  it("hoy", () => {
    expect(formatRelativeDay("es", new Date(2026, 7, 15, 3, 0), NOW)).toBe("hoy");
  });

  it("ayer", () => {
    expect(formatRelativeDay("es", new Date(2026, 7, 14, 23, 0), NOW)).toBe("ayer");
  });

  it("hace 3 días", () => {
    expect(formatRelativeDay("es", new Date(2026, 7, 12), NOW)).toBe("hace 3 días");
  });

  it("hace 2 meses (más de 30 días, menos de un año)", () => {
    // ~63 días atrás → round(63/30) = 2 meses.
    expect(formatRelativeDay("es", new Date(2026, 5, 13), NOW)).toBe("hace 2 meses");
  });

  it("hace 2 años (más de 365 días)", () => {
    expect(formatRelativeDay("es", new Date(2024, 7, 15), NOW)).toBe("hace 2 años");
  });

  it(
    "borde de huso: 02:00 UTC del día siguiente sigue siendo 'hoy' en UTC-3 " +
      "(el diff se calcula sobre el día calendario LOCAL, no sobre milisegundos crudos)",
    () => {
      // 15/ago 23:00 local (UTC-3) y 16/ago 02:00 local (UTC-3, "ahora") son
      // días calendario distintos y están a solo 3 horas de diferencia —
      // si el cálculo usara un diff de ms redondeado a días, podría leer
      // "hoy" cuando en realidad ya cruzó la medianoche local, o viceversa.
      // Acá se fuerza el caso real: la fecha a formatear es literalmente
      // "ayer" a las 23:00 local y `now` es "hoy" a las 02:00 local.
      const yesterdayLate = new Date(2026, 7, 15, 23, 0);
      const todayEarly = new Date(2026, 7, 16, 2, 0);
      expect(formatRelativeDay("es", yesterdayLate, todayEarly)).toBe("ayer");
    },
  );
});

describe("decimalSeparatorForLocale — con preferencia fijada en Ajustes", () => {
  it("'locale' (default) se comporta como antes de que existiera el ajuste", () => {
    expect(decimalSeparatorForLocale("es")).toBe(",");
    expect(decimalSeparatorForLocale("en")).toBe(".");
  });

  it("una preferencia fijada gana sin importar el idioma", () => {
    useFormatPreferencesStore.getState().setDecimalSeparator("period");
    try {
      expect(decimalSeparatorForLocale("es")).toBe(".");
      expect(decimalSeparatorForLocale("pt")).toBe(".");
    } finally {
      useFormatPreferencesStore.getState().setDecimalSeparator("locale");
    }
  });
});
