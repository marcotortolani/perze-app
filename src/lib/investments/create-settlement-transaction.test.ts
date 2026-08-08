import { describe, expect, it, vi } from "vitest";
import type { HouseholdRow } from "@/lib/db/schema";

vi.mock("@/lib/repos/fx-repo", () => ({
  fxRepo: { resolve: vi.fn(() => Promise.reject(new Error("fxRepo.resolve should not be called"))) },
}));
vi.mock("@/lib/repos/transactions-repo", () => ({
  transactionsRepo: {
    create: vi.fn(() => Promise.reject(new Error("transactionsRepo.create should not be called"))),
    findByTradeId: vi.fn(() => Promise.resolve(null)),
    softDelete: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock("@/features/capture/save-transaction", () => ({
  resolveFxForAccountCurrency: vi.fn(() => Promise.reject(new Error("resolveFxForAccountCurrency should not be called"))),
}));

const { createSettlementTransaction, SettlementError } = await import("./create-settlement-transaction");

const household = { id: "h1", baseCurrency: "UYU" } as HouseholdRow;

describe("createSettlementTransaction", () => {
  it("rejects a credit_card settlement account before touching FX or writing a transaction", async () => {
    await expect(
      createSettlementTransaction({
        household,
        userId: "u1",
        tradeId: "trade-1",
        netAmount: -800n,
        instrumentCurrency: "USD",
        instrumentSymbol: "AAPL",
        accountId: "card-1",
        accountCurrency: "USD",
        accountKind: "credit_card",
      })
    ).rejects.toThrow(SettlementError);
  });
});
