import { describe, expect, it, vi } from "vitest";
import type { HouseholdRow } from "@/lib/db/schema";
import type { RecurringRuleInput } from "./recurring-schedule";

const resolveFxForAccountCurrency = vi.fn();
vi.mock("@/features/capture/save-transaction", () => ({
  resolveFxForAccountCurrency: (...args: unknown[]) => resolveFxForAccountCurrency(...args),
}));

const { computeMonthlyCommitted } = await import("./recurring-schedule");

function household(baseCurrency: string): HouseholdRow {
  return { id: "h1", name: "Casa", baseCurrency, baseCountry: "UY", periodStartDay: 1, weekStart: 1, enabledModules: [], settings: {}, createdBy: "u1", createdAt: "", updatedAt: "", clientRev: 1, purgedAt: null };
}

function rule(overrides: Partial<RecurringRuleInput>): RecurringRuleInput {
  return {
    id: "a",
    kind: "expense",
    expectedAmount: 100n,
    currencyCode: "UYU",
    frequency: "monthly",
    anchorDate: "2026-01-01",
    dayOfMonth: 1,
    endDate: null,
    ...overrides,
  };
}

describe("computeMonthlyCommitted", () => {
  it("suma solo gastos, normalizados por frecuencia y convertidos a la base", async () => {
    resolveFxForAccountCurrency.mockResolvedValue({ fxRate: 1n, fxSource: "identity", fxProvider: null, fxQuoteKind: null, fxResolvedAt: null, amountBase: 1200n });
    const rules = [
      rule({ id: "a", kind: "expense", expectedAmount: 1200n, frequency: "yearly" }), // equivalente mensual: 100
      rule({ id: "b", kind: "income", expectedAmount: 5000n }), // ingresos no comprometen
    ];
    const result = await computeMonthlyCommitted(household("UYU"), rules);
    expect(resolveFxForAccountCurrency).toHaveBeenCalledTimes(1); // solo la de gasto
    expect(result.excludedCount).toBe(0);
  });

  it("excluye (nunca suma como 0) las reglas cuya conversión no se pudo resolver", async () => {
    resolveFxForAccountCurrency.mockResolvedValue({ fxRate: null, fxSource: "pending", fxProvider: null, fxQuoteKind: null, fxResolvedAt: null, amountBase: null });
    const rules = [rule({ id: "a", kind: "expense", currencyCode: "USD" })];
    const result = await computeMonthlyCommitted(household("UYU"), rules);
    expect(result.total).toBe(0n);
    expect(result.excludedCount).toBe(1);
  });
});
