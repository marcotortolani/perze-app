import { describe, expect, it } from "vitest";
import {
  add,
  CurrencyMismatchError,
  money,
  roundHalfEven,
  scaleByFraction,
  splitEvenly,
  subtract,
  sum,
} from "./money";

describe("aritmética básica", () => {
  it("suma y resta en la misma moneda", () => {
    expect(add(money(1000n, "UYU"), money(250n, "UYU"))).toEqual(money(1250n, "UYU"));
    expect(subtract(money(1000n, "UYU"), money(250n, "UYU"))).toEqual(money(750n, "UYU"));
  });

  it("falla al operar entre monedas distintas", () => {
    expect(() => add(money(100n, "UYU"), money(100n, "USD"))).toThrow(CurrencyMismatchError);
  });

  it("sum() de una lista vuelve a cero si está vacía", () => {
    expect(sum("UYU", [])).toEqual(money(0n, "UYU"));
  });
});

describe("redondeo bancario (half-to-even)", () => {
  it("redondea hacia el par cuando el resto es exactamente la mitad", () => {
    expect(roundHalfEven(5n, 2n)).toBe(2n); // 2.5 -> 2
    expect(roundHalfEven(7n, 2n)).toBe(4n); // 3.5 -> 4
    expect(roundHalfEven(-5n, 2n)).toBe(-2n);
  });

  it("redondea normal cuando el resto no es la mitad exacta", () => {
    expect(roundHalfEven(7n, 3n)).toBe(2n); // 2.333 -> 2
    expect(roundHalfEven(8n, 3n)).toBe(3n); // 2.666 -> 3
  });
});

describe("scaleByFraction — nunca pasa por float", () => {
  it("multiplica por un entero", () => {
    expect(scaleByFraction(money(450n, "UYU"), 3n, 1n)).toEqual(money(1350n, "UYU"));
  });

  it("divide sin perder precisión donde el resultado es exacto", () => {
    expect(scaleByFraction(money(1000n, "UYU"), 1n, 4n)).toEqual(money(250n, "UYU"));
  });
});

describe("splitEvenly — nunca pierde un centavo", () => {
  it("reparte 100 en 3 partes sumando exacto", () => {
    const parts = splitEvenly(money(100n, "UYU"), 3);
    expect(parts.map((p) => p.amount)).toEqual([34n, 33n, 33n]);
    expect(sum("UYU", parts)).toEqual(money(100n, "UYU"));
  });

  it("reparte exacto cuando divide justo", () => {
    const parts = splitEvenly(money(900n, "UYU"), 3);
    expect(parts.map((p) => p.amount)).toEqual([300n, 300n, 300n]);
  });
});
