import { describe, expect, it } from "vitest";
import { decimalSeparatorForLocale, formatNumericDate } from "./formatting";
import { useFormatPreferencesStore } from "@/stores/format-preferences-store";

const SAMPLE_DATE = new Date(2026, 7, 2); // 2 de agosto de 2026 (mes 0-indexado)

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
