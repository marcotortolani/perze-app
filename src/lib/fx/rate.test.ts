import { describe, expect, it } from "vitest";
import { money } from "../money/money";
import { convert, formatRate, formatRateShort, invertRate, parseRate, rateFromInteger } from "./rate";

describe("parseRate / formatRate", () => {
  it("ida y vuelta sin pérdida", () => {
    const scaled = parseRate("1234.567890123456");
    expect(formatRate(scaled)).toBe("1234.567890123456");
  });

  it("negativo", () => {
    expect(formatRate(parseRate("-0.5"))).toBe("-0.500000000000");
  });
});

describe("formatRateShort", () => {
  it("trunca a 2 decimales por default — nunca los 12 internos de formatRate", () => {
    expect(formatRateShort(parseRate("1560.000000000000"))).toBe("1560.00");
    expect(formatRateShort(parseRate("3.333333333333"))).toBe("3.33");
  });

  it("rellena con ceros si hay menos decimales que los pedidos", () => {
    expect(formatRateShort(rateFromInteger(1000))).toBe("1000.00");
  });

  it("acepta una cantidad de decimales distinta", () => {
    expect(formatRateShort(parseRate("3.333333333333"), 4)).toBe("3.3333");
  });

  it("trunca, no redondea (mismo criterio que RateRow ya usaba)", () => {
    // 3.339... truncado a 2 decimales da 3.33, no 3.34
    expect(formatRateShort(parseRate("3.339999999999"))).toBe("3.33");
  });
});

describe("invertRate", () => {
  it("1/1000 y volver", () => {
    const r = rateFromInteger(1000);
    const inv = invertRate(r);
    // 1/1000 = 0.001
    expect(formatRate(inv)).toBe("0.001000000000");
  });

  it("invertir dos veces vuelve (aprox, redondeo half-even)", () => {
    const r = parseRate("3.333333333333");
    expect(invertRate(invertRate(r))).toBe(r);
  });
});

describe("convert — fixed point, sin floats", () => {
  it("misma moneda es no-op", () => {
    const m = money(1000n, "USD");
    expect(convert(m, "USD", rateFromInteger(1))).toBe(m);
  });

  it("convierte USD -> ARS a un rate entero", () => {
    // 10.00 USD * 1000 ARS/USD = 10000.00 ARS
    const result = convert(money(1000n, "USD"), "ARS", rateFromInteger(1000));
    expect(result).toEqual(money(1_000_000n, "ARS"));
  });

  it("el rate congelado nunca cambia al cambiar la cotización actual", () => {
    const frozenRate = rateFromInteger(1000);
    const result1 = convert(money(1000n, "USD"), "ARS", frozenRate);
    // la "cotización actual" sube a 1200, pero el rate ya congelado es el mismo objeto
    const result2 = convert(money(1000n, "USD"), "ARS", frozenRate);
    expect(result1).toEqual(result2);
  });

  it("ajusta por diferencia de decimales (USD 2 dec -> CLP 0 dec)", () => {
    // 100.00 USD a 900 CLP por USD = 90.000 CLP
    const result = convert(money(10000n, "USD"), "CLP", rateFromInteger(900));
    expect(result).toEqual(money(90_000n, "CLP"));
  });

  it("crypto con 8 decimales", () => {
    // 0.001 BTC a 50000 USD/BTC = 50 USD
    const result = convert(money(100_000n, "BTC"), "USD", rateFromInteger(50_000));
    expect(result).toEqual(money(5000n, "USD"));
  });
});
