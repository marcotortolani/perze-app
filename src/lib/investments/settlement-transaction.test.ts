import { describe, expect, it } from "vitest";
import { computeSettlementAmount } from "./settlement-transaction";

describe("computeSettlementAmount", () => {
  it("misma moneda: invierte el signo de netAmount, sin conversión", () => {
    // Compra: netAmount positivo (trades.net_amount) → sale plata de la cuenta (negativo).
    expect(computeSettlementAmount({ netAmount: 50000n, instrumentCurrency: "ARS", accountCurrency: "ARS", conversionRate: null })).toEqual({
      amount: -50000n,
      currencyCode: "ARS",
      originalAmount: null,
      originalCurrency: null,
      originalRate: null,
    });
  });

  it("misma moneda, venta: netAmount negativo → entra plata a la cuenta (positivo)", () => {
    expect(computeSettlementAmount({ netAmount: -20000n, instrumentCurrency: "ARS", accountCurrency: "ARS", conversionRate: null })).toEqual({
      amount: 20000n,
      currencyCode: "ARS",
      originalAmount: null,
      originalCurrency: null,
      originalRate: null,
    });
  });

  it("monedas distintas con cotización: convierte y preserva el original", () => {
    const result = computeSettlementAmount({ netAmount: 100_00n, instrumentCurrency: "USD", accountCurrency: "ARS", conversionRate: 1500_000000000000n });
    expect(result.currencyCode).toBe("ARS");
    expect(result.originalAmount).toBe(-100_00n);
    expect(result.originalCurrency).toBe("USD");
    expect(result.originalRate).toBe(1500_000000000000n);
    expect(result.amount).toBeLessThan(0n); // compra: sale plata de la cuenta en ARS
  });

  it("monedas distintas sin cotización: amount en 0, nunca se inventa un rate (needs_capture_fx)", () => {
    const result = computeSettlementAmount({ netAmount: 100_00n, instrumentCurrency: "USD", accountCurrency: "ARS", conversionRate: null });
    expect(result.amount).toBe(0n);
    expect(result.currencyCode).toBe("ARS");
    expect(result.originalAmount).toBe(-100_00n);
    expect(result.originalCurrency).toBe("USD");
    expect(result.originalRate).toBeNull();
  });
});
