import { afterEach, describe, expect, it } from "vitest";
import { useFormatPreferencesStore } from "@/stores/format-preferences-store";
import { money } from "./money";
import { formatAmount, formatAmountCompact, formatNumber } from "./format";

describe("formatAmount — es-UY", () => {
  it("positivo con signo", () => {
    expect(formatAmount(money(125000n, "UYU"))).toBe("+$U 1.250,00");
  });

  it("negativo", () => {
    expect(formatAmount(money(-125050n, "UYU"))).toBe("−$U 1.250,50");
  });

  it("sin signo (saldos)", () => {
    expect(formatAmount(money(125000n, "UYU"), { showSign: false })).toBe("$U 1.250,00");
  });

  it("moneda sin decimales", () => {
    expect(formatAmount(money(1250n, "CLP"), { showSign: false })).toBe("CLP$ 1.250");
  });
});

describe("formatAmount — en-US", () => {
  it("usa punto decimal y coma de miles", () => {
    expect(formatAmount(money(125050n, "USD"), { locale: "en-US", showSign: false })).toBe(
      "US$ 1,250.50"
    );
  });
});

describe("formatAmountCompact", () => {
  it("por debajo del umbral usa el formato completo", () => {
    expect(formatAmountCompact(money(12500n, "UYU"), { showSign: false })).toBe("$U 125,00");
  });

  it("millones", () => {
    expect(formatAmountCompact(money(1_250_000_00n, "UYU"), { showSign: false })).toBe("$U 1,2 M");
  });
});

describe("D53 — ajuste de Ajustes → Formato + idioma de la UI nunca dan separadores repetidos", () => {
  afterEach(() => {
    useFormatPreferencesStore.setState({ decimalSeparator: "locale" });
  });

  it("ajuste \"coma\" con locale en-US: antes daba \"1,500,00\" (coma de miles por Intl + coma decimal por el ajuste)", () => {
    useFormatPreferencesStore.setState({ decimalSeparator: "comma" });
    expect(formatAmount(money(1_500_000_00n, "USD"), { locale: "en-US", showSign: false })).toBe("US$ 1.500.000,00");
  });

  it("ajuste \"punto\" con locale es-UY: el de miles pasa a coma, nunca dos puntos", () => {
    useFormatPreferencesStore.setState({ decimalSeparator: "period" });
    expect(formatAmount(money(1_500_000_00n, "UYU"), { showSign: false })).toBe("$U 1,500,000.00");
  });
});

describe("formatNumber", () => {
  afterEach(() => {
    useFormatPreferencesStore.setState({ decimalSeparator: "locale" });
  });

  it("es-UY por defecto: punto de miles, coma decimal", () => {
    expect(formatNumber(1234.5, 2)).toBe("1.234,50");
  });

  it("en-US: coma de miles, punto decimal", () => {
    expect(formatNumber(1234.5, 2, { locale: "en-US" })).toBe("1,234.50");
  });

  it("negativo", () => {
    expect(formatNumber(-1234.5, 2)).toBe("−1.234,50");
  });

  it("sin decimales", () => {
    expect(formatNumber(1234, 0)).toBe("1.234");
  });

  it("respeta el ajuste explícito por sobre el locale", () => {
    useFormatPreferencesStore.setState({ decimalSeparator: "comma" });
    expect(formatNumber(1234.5, 2, { locale: "en-US" })).toBe("1.234,50");
  });
});
