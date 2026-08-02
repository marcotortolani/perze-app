import { describe, expect, it } from "vitest";
import { appendKeypadRateDigit, parseKeypadRate } from "./rate-keypad";
import { formatRate } from "./rate";

describe("appendKeypadRateDigit", () => {
  it("acumula dígitos", () => {
    expect(appendKeypadRateDigit("4", "0", ",")).toBe("40");
  });

  it("agrega el separador decimal, con 0 implícito si estaba vacío", () => {
    expect(appendKeypadRateDigit("", ",", ",")).toBe("0,");
    expect(appendKeypadRateDigit("40", ",", ",")).toBe("40,");
  });

  it("no permite un segundo separador decimal", () => {
    expect(appendKeypadRateDigit("40,5", ",", ",")).toBe("40,5");
  });

  it("backspace borra el último carácter", () => {
    expect(appendKeypadRateDigit("40,5", "backspace", ",")).toBe("40,");
    expect(appendKeypadRateDigit("", "backspace", ",")).toBe("");
  });

  it("ignora operadores — un tipo de cambio no es una cuenta de Keypad", () => {
    expect(appendKeypadRateDigit("40", "+", ",")).toBe("40");
    expect(appendKeypadRateDigit("40", "×", ",")).toBe("40");
  });

  it("respeta el largo máximo", () => {
    expect(appendKeypadRateDigit("123456789012345", "6", ",", 15)).toBe("123456789012345");
  });
});

describe("parseKeypadRate", () => {
  it("vacío o solo el separador es inválido", () => {
    expect(parseKeypadRate("", ",")).toBeNull();
    expect(parseKeypadRate(",", ",")).toBeNull();
  });

  it("cero o negativo es inválido — un tipo de cambio nunca es 0", () => {
    expect(parseKeypadRate("0", ",")).toBeNull();
    expect(parseKeypadRate("0,00", ",")).toBeNull();
  });

  it("parsea un entero", () => {
    expect(formatRate(parseKeypadRate("40", ",")!)).toBe("40.000000000000");
  });

  it("parsea con decimales, normalizando el separador del locale", () => {
    expect(formatRate(parseKeypadRate("40,55", ",")!)).toBe("40.550000000000");
    expect(formatRate(parseKeypadRate("40.55", ".")!)).toBe("40.550000000000");
  });

  it("un decimal a medio escribir (termina en separador) igual se parsea", () => {
    expect(formatRate(parseKeypadRate("40,", ",")!)).toBe("40.000000000000");
  });
});
