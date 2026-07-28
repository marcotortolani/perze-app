import { describe, expect, it } from "vitest";
import { money } from "./money";
import { formatAmount, formatAmountCompact } from "./format";

describe("formatAmount — es-UY", () => {
  it("positivo con signo", () => {
    expect(formatAmount(money(125000n, "UYU"))).toBe("+$ 1.250,00");
  });

  it("negativo", () => {
    expect(formatAmount(money(-125050n, "UYU"))).toBe("−$ 1.250,50");
  });

  it("sin signo (saldos)", () => {
    expect(formatAmount(money(125000n, "UYU"), { showSign: false })).toBe("$ 1.250,00");
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
    expect(formatAmountCompact(money(12500n, "UYU"), { showSign: false })).toBe("$ 125,00");
  });

  it("millones", () => {
    expect(formatAmountCompact(money(1_250_000_00n, "UYU"), { showSign: false })).toBe("$ 1,2 M");
  });
});
