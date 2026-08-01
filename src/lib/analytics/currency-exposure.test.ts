import { describe, expect, it } from "vitest";
import { computeCurrencyExposure } from "./currency-exposure";
import { money } from "../money/money";
import type { NetWorthAccountInput } from "./balances";

describe("computeCurrencyExposure", () => {
  const accounts: NetWorthAccountInput[] = [
    { id: "a1", currentBalance: 100000n, currencyCode: "UYU", includeInNetWorth: true },
    { id: "a2", currentBalance: 1000n, currencyCode: "USD", includeInNetWorth: true },
  ];
  const convert = (amount: { amount: bigint; currency: string }, toCurrency: string) =>
    amount.currency === "USD" ? money(amount.amount * 40n, toCurrency) : null;

  it("computes native and base amounts with percentages", () => {
    const result = computeCurrencyExposure(accounts, "UYU", convert);
    const uyu = result.rows.find((r) => r.currency === "UYU")!;
    const usd = result.rows.find((r) => r.currency === "USD")!;
    expect(uyu.nativeAmount.amount).toBe(100000n);
    expect(usd.baseAmount?.amount).toBe(40000n);
    expect(result.totalBase.amount).toBe(140000n);
    expect(usd.pctOfNetWorth).toBeCloseTo((40000 / 140000) * 100);
  });

  it("excludes accounts whose currency has no resolved rate, and counts them", () => {
    const withPending: NetWorthAccountInput[] = [...accounts, { id: "a3", currentBalance: 500n, currencyCode: "ARS", includeInNetWorth: true }];
    const result = computeCurrencyExposure(withPending, "UYU", convert);
    expect(result.excludedAccountCount).toBe(1);
    const ars = result.rows.find((r) => r.currency === "ARS")!;
    expect(ars.baseAmount).toBeNull();
    expect(ars.pctOfNetWorth).toBeNull();
    expect(result.totalBase.amount).toBe(140000n); // ARS no entra al total
  });

  it("ignores accounts excluded from net worth", () => {
    const withExcluded: NetWorthAccountInput[] = [...accounts, { id: "a4", currentBalance: 999n, currencyCode: "USD", includeInNetWorth: false }];
    const result = computeCurrencyExposure(withExcluded, "UYU", convert);
    const usd = result.rows.find((r) => r.currency === "USD")!;
    expect(usd.nativeAmount.amount).toBe(1000n); // no suma los 999 del excluido
  });
});
