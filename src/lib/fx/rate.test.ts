import { describe, expect, it } from "vitest";
import { money } from "../money/money";
import { convert, formatRate, formatRateTrimmed, invertRate, parseRate, rateFromAmounts, rateFromInteger } from "./rate";

describe("parseRate / formatRate", () => {
  it("ida y vuelta sin pérdida", () => {
    const scaled = parseRate("1234.567890123456");
    expect(formatRate(scaled)).toBe("1234.567890123456");
  });

  it("negativo", () => {
    expect(formatRate(parseRate("-0.5"))).toBe("-0.500000000000");
  });
});

describe("parseRate — más de RATE_DECIMALS dígitos", () => {
  it("redondea el último dígito en vez de truncarlo", () => {
    // 13 decimales, el 13° (7) redondea el 12° hacia arriba — truncar
    // habría dejado "...789012", perdiendo el 7 en silencio.
    expect(formatRate(parseRate("1.1234567890127"))).toBe("1.123456789013");
  });

  it("half-even: dos mitades exactas redondean las dos al mismo par", () => {
    // 13,5 sube a 14 (par); 14,5 se queda en 14 (ya par) — el ejemplo
    // clásico de redondeo bancario, no "5 siempre para arriba".
    expect(formatRate(parseRate("0.0000000000135"))).toBe("0.000000000014");
    expect(formatRate(parseRate("0.0000000000145"))).toBe("0.000000000014");
  });

  it("el redondeo puede acarrear hasta la parte entera", () => {
    expect(formatRate(parseRate("1.9999999999995"))).toBe("2.000000000000");
  });

  it("con exactamente RATE_DECIMALS dígitos no cambia nada", () => {
    expect(formatRate(parseRate("1.123456789012"))).toBe("1.123456789012");
  });
});

describe("formatRateTrimmed", () => {
  it("saca los ceros finales, nunca corta un dígito significativo", () => {
    expect(formatRateTrimmed(parseRate("1560.250000000000"))).toBe("1560.25");
    expect(formatRateTrimmed(parseRate("3.333333333333"))).toBe("3.333333333333");
  });

  it("un rate entero queda sin punto decimal", () => {
    expect(formatRateTrimmed(rateFromInteger(1000))).toBe("1000");
    expect(formatRateTrimmed(parseRate("1560.000000000000"))).toBe("1560");
  });

  it("una tasa invertida chica no pierde precisión (nunca '0,00')", () => {
    // 1/1560 ≈ 0.000641025641026
    const small = invertRate(rateFromInteger(1560));
    expect(formatRateTrimmed(small)).toBe("0.000641025641");
  });

  it("un solo cero final se saca, como pide el ejemplo de referencia", () => {
    expect(formatRateTrimmed(parseRate("0.025000000000"))).toBe("0.025");
  });

  it("negativo", () => {
    expect(formatRateTrimmed(parseRate("-0.500000000000"))).toBe("-0.5");
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

describe("rateFromAmounts — inverso de convert", () => {
  it("despeja el mismo rate entero que se usó para convertir", () => {
    const rate = rateFromInteger(1525);
    const from = money(10000n, "USD"); // 100.00 USD
    const to = convert(from, "ARS", rate);
    expect(rateFromAmounts(from, to)).toBe(rate);
  });

  it("ajusta por diferencia de decimales, igual que convert", () => {
    const rate = rateFromInteger(900);
    const from = money(10000n, "USD"); // 100.00 USD, 2 decimales
    const to = convert(from, "CLP", rate); // 0 decimales
    expect(rateFromAmounts(from, to)).toBe(rate);
  });

  it("null cuando el monto de origen es cero", () => {
    expect(rateFromAmounts(money(0n, "USD"), money(1000n, "ARS"))).toBeNull();
  });
});
