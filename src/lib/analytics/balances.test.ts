import { describe, expect, it } from "vitest";
import { money } from "../money/money";
import { convert, rateFromInteger } from "../fx/rate";
import { computeNetWorth, sumBalancesByCurrency } from "./balances";

describe("computeNetWorth", () => {
  it("suma cuentas en la misma moneda", () => {
    const result = computeNetWorth({
      accounts: [
        { id: "a1", currentBalance: 100_000n, currencyCode: "UYU", includeInNetWorth: true },
        { id: "a2", currentBalance: 50_000n, currencyCode: "UYU", includeInNetWorth: true },
      ],
      baseCurrency: "UYU",
      convert: () => null,
    });
    expect(result.netWorth).toEqual(money(150_000n, "UYU"));
    expect(result.included).toBe(2);
  });

  it("suma investmentsValue como activo, ya en moneda base", () => {
    const result = computeNetWorth({
      accounts: [{ id: "a1", currentBalance: 100_000n, currencyCode: "UYU", includeInNetWorth: true }],
      baseCurrency: "UYU",
      convert: () => null,
      investmentsValue: 50_000n,
    });
    expect(result.netWorth).toEqual(money(150_000n, "UYU"));
    expect(result.assets).toEqual(money(150_000n, "UYU"));
  });

  it("sin investmentsValue (módulo apagado), no cambia nada — mismo comportamiento que antes", () => {
    const result = computeNetWorth({
      accounts: [{ id: "a1", currentBalance: 100_000n, currencyCode: "UYU", includeInNetWorth: true }],
      baseCurrency: "UYU",
      convert: () => null,
    });
    expect(result.netWorth).toEqual(money(100_000n, "UYU"));
  });

  it("convierte cuentas en otra moneda a la moneda base", () => {
    const rate = rateFromInteger(1000); // 1 USD = 1000 UYU... base sería UYU
    const result = computeNetWorth({
      accounts: [{ id: "a1", currentBalance: 100n, currencyCode: "USD", includeInNetWorth: true }],
      baseCurrency: "UYU",
      convert: (amount, to) => convert(amount, to, rate),
    });
    // 1.00 USD * 1000 = 1000.00 UYU
    expect(result.netWorth).toEqual(money(100_000n, "UYU"));
  });

  it("excluye cuentas needs_fx, nunca las cuenta como 0", () => {
    const result = computeNetWorth({
      accounts: [
        { id: "a1", currentBalance: 100_000n, currencyCode: "UYU", includeInNetWorth: true },
        { id: "a2", currentBalance: 5000n, currencyCode: "ARS", includeInNetWorth: true },
      ],
      baseCurrency: "UYU",
      convert: () => null, // sin rate para ARS
    });
    expect(result.netWorth).toEqual(money(100_000n, "UYU"));
    expect(result.excludedAccountIds).toEqual(["a2"]);
  });

  it("respeta includeInNetWorth = false", () => {
    const result = computeNetWorth({
      accounts: [{ id: "a1", currentBalance: 100_000n, currencyCode: "UYU", includeInNetWorth: false }],
      baseCurrency: "UYU",
      convert: () => null,
    });
    expect(result.netWorth).toEqual(money(0n, "UYU"));
    expect(result.included).toBe(0);
  });

  it("una tarjeta de crédito en deuda (saldo negativo) resta del patrimonio", () => {
    const result = computeNetWorth({
      accounts: [
        { id: "a1", currentBalance: 100_000n, currencyCode: "UYU", includeInNetWorth: true },
        { id: "a2", currentBalance: -30_000n, currencyCode: "UYU", includeInNetWorth: true },
      ],
      baseCurrency: "UYU",
      convert: () => null,
    });
    expect(result.netWorth).toEqual(money(70_000n, "UYU"));
  });
});

describe("sumBalancesByCurrency", () => {
  it("agrupa por moneda sin convertir", () => {
    const result = sumBalancesByCurrency([
      { id: "a1", currentBalance: 100_000n, currencyCode: "UYU", includeInNetWorth: true },
      { id: "a2", currentBalance: 50_000n, currencyCode: "UYU", includeInNetWorth: true },
      { id: "a3", currentBalance: 200n, currencyCode: "USD", includeInNetWorth: true },
    ]);
    expect(result.get("UYU")).toEqual(money(150_000n, "UYU"));
    expect(result.get("USD")).toEqual(money(200n, "USD"));
  });
});
