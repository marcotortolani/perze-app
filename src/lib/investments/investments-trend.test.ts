import { describe, expect, it } from "vitest";
import { computeDayValue, nearestPriceOnOrBefore } from "./investments-trend";

describe("nearestPriceOnOrBefore", () => {
  const history = [
    { asOf: "2026-08-01", close: 100 },
    { asOf: "2026-08-03", close: 110 },
    { asOf: "2026-08-05", close: 105 },
  ];

  it("devuelve el precio exacto de la fecha si existe", () => {
    expect(nearestPriceOnOrBefore(history, "2026-08-03")).toBe(110);
  });

  it("carry-forward: sin snapshot ese día, usa el último conocido anterior (fin de semana/feriado)", () => {
    expect(nearestPriceOnOrBefore(history, "2026-08-04")).toBe(110);
    expect(nearestPriceOnOrBefore(history, "2026-08-02")).toBe(100);
  });

  it("null si la fecha es anterior al primer precio conocido — nunca inventa un valor", () => {
    expect(nearestPriceOnOrBefore(history, "2026-07-31")).toBeNull();
  });

  it("historial vacío devuelve null", () => {
    expect(nearestPriceOnOrBefore([], "2026-08-03")).toBeNull();
  });
});

describe("computeDayValue", () => {
  const priceHistory = new Map([
    ["i1", [{ asOf: "2026-08-01", close: 100 }]],
    ["i2", [{ asOf: "2026-08-01", close: 50 }]],
  ]);

  it("suma cantidad × precio, misma moneda que la base", () => {
    const result = computeDayValue([{ instrumentId: "i1", quantity: 10, currencyCode: "USD" }], priceHistory, "2026-08-01", "USD", () => null);
    expect(result.value).toBe(100_000n); // 10 * 100 = 1000.00 USD
    expect(result.excludedCount).toBe(0);
  });

  it("convierte a moneda base cuando difiere", () => {
    const result = computeDayValue(
      [{ instrumentId: "i1", quantity: 10, currencyCode: "USD" }],
      priceHistory,
      "2026-08-01",
      "UYU",
      (amount) => amount * 40n // 1 USD = 40 UYU, simplificado para el test
    );
    expect(result.value).toBe(40_000_00n); // 1000 USD * 40 = 40000 UYU
  });

  it("posición sin precio conocido a esa fecha se excluye, nunca cuenta como 0", () => {
    const result = computeDayValue([{ instrumentId: "no-existe", quantity: 5, currencyCode: "USD" }], priceHistory, "2026-08-01", "USD", () => null);
    expect(result.value).toBe(0n);
    expect(result.excludedCount).toBe(1);
  });

  it("posición sin cotización a la moneda base se excluye, nunca cuenta como 0", () => {
    const result = computeDayValue([{ instrumentId: "i1", quantity: 10, currencyCode: "USD" }], priceHistory, "2026-08-01", "UYU", () => null);
    expect(result.value).toBe(0n);
    expect(result.excludedCount).toBe(1);
  });

  it("suma varias posiciones", () => {
    const result = computeDayValue(
      [
        { instrumentId: "i1", quantity: 10, currencyCode: "USD" },
        { instrumentId: "i2", quantity: 4, currencyCode: "USD" },
      ],
      priceHistory,
      "2026-08-01",
      "USD",
      () => null
    );
    expect(result.value).toBe(120_000n); // 1000 + 200 = 1200.00 USD
  });
});
