import { describe, expect, it } from "vitest";
import { newTransactionSchema } from "./transaction";

const HOUSEHOLD = "018f2f7a-1b1b-7b1b-8b1b-1b1b1b1b1b1b";
const USER = "018f2f7a-1b1b-7b1b-8b1b-1b1b1b1b1b1c";
const ACCOUNT = "018f2f7a-1b1b-7b1b-8b1b-1b1b1b1b1b1d";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    householdId: HOUSEHOLD,
    createdBy: USER,
    kind: "expense",
    occurredAt: "2026-07-27T12:00:00.000Z",
    accountId: ACCOUNT,
    counterAccountId: null,
    amount: 1000n,
    currencyCode: "UYU",
    fxRate: null,
    fxSource: "identity",
    fxProvider: null,
    fxQuoteKind: null,
    fxResolvedAt: null,
    amountBase: null,
    counterAmount: null,
    counterCurrencyCode: null,
    counterFxRate: null,
    categoryId: null,
    payeeId: null,
    note: null,
    attachments: [],
    location: null,
    status: "cleared",
    visibility: "household",
    recurringId: null,
    installmentGroupId: null,
    installmentNumber: null,
    installmentTotal: null,
    source: "manual",
    ...overrides,
  };
}

describe("newTransactionSchema", () => {
  it("acepta un gasto válido", () => {
    expect(newTransactionSchema.safeParse(baseInput()).success).toBe(true);
  });

  it("rechaza un gasto con monto negativo", () => {
    const result = newTransactionSchema.safeParse(baseInput({ amount: -100n }));
    expect(result.success).toBe(false);
  });

  it("acepta un ajuste con monto negativo", () => {
    const result = newTransactionSchema.safeParse(baseInput({ kind: "adjustment", amount: -100n }));
    expect(result.success).toBe(true);
  });

  it("rechaza fxRate sin amountBase", () => {
    const result = newTransactionSchema.safeParse(baseInput({ fxRate: 1_000_000_000_000n, amountBase: null }));
    expect(result.success).toBe(false);
  });

  it("rechaza una transferencia sin cuenta de destino", () => {
    const result = newTransactionSchema.safeParse(baseInput({ kind: "transfer", counterAccountId: null }));
    expect(result.success).toBe(false);
  });
});
