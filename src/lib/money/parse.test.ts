import { describe, expect, it } from "vitest";
import { money } from "./money";
import { parseAmountString, parseScalarFraction } from "./parse";

describe("parseAmountString — es-UY / es-AR (coma decimal, punto de miles)", () => {
  it("monto simple", () => {
    expect(parseAmountString("1250", "UYU", "es-UY")).toEqual(money(125000n, "UYU"));
  });

  it("con miles y decimales", () => {
    expect(parseAmountString("1.250,50", "UYU", "es-UY")).toEqual(money(125050n, "UYU"));
  });

  it("negativo", () => {
    expect(parseAmountString("-40,5", "UYU", "es-UY")).toEqual(money(-4050n, "UYU"));
  });

  it("moneda sin decimales (CLP)", () => {
    expect(parseAmountString("1.250", "CLP", "es-UY")).toEqual(money(1250n, "CLP"));
  });

  it("crypto con 8 decimales", () => {
    expect(parseAmountString("0,00012345", "BTC", "es-UY")).toEqual(money(12345n, "BTC"));
  });
});

describe("parseAmountString — en-US (punto decimal, coma de miles)", () => {
  it("con miles y decimales", () => {
    expect(parseAmountString("1,250.50", "USD", "en-US")).toEqual(money(125050n, "USD"));
  });
});

describe("parseAmountString — sin pérdida de precisión en cadenas", () => {
  it("no trunca de más ni de menos con más decimales de los que la moneda admite", () => {
    // UYU tiene 2 decimales: el tercero se descarta, no se redondea con float.
    expect(parseAmountString("10,999", "UYU", "es-UY")).toEqual(money(1099n, "UYU"));
  });

  it("rellena con ceros si faltan decimales", () => {
    expect(parseAmountString("10,5", "UYU", "es-UY")).toEqual(money(1050n, "UYU"));
  });
});

describe("parseScalarFraction", () => {
  it("entero", () => {
    expect(parseScalarFraction("3", "es-UY")).toEqual({ numerator: 3n, denominator: 1n });
  });

  it("con decimales", () => {
    expect(parseScalarFraction("2,5", "es-UY")).toEqual({ numerator: 25n, denominator: 10n });
  });
});
