import { describe, expect, it } from "vitest";
import { rankPayeesByUsage } from "./payee-usage";
import type { PayeeRow, TransactionRow } from "@/lib/db/schema";

function payee(id: string, name = id): PayeeRow {
  return { id, householdId: "hh-1", name, defaultCategoryId: null, defaultAccountId: null, logoUrl: null, aliases: [], clientRev: 1 };
}

function tx(payeeId: string | null): Pick<TransactionRow, "payeeId"> {
  return { payeeId };
}

describe("rankPayeesByUsage", () => {
  const payees = [payee("a", "aa-payee"), payee("b", "bb-payee"), payee("c", "cc-payee"), payee("d", "dd-payee")];

  it("prioriza uso real y rellena hasta el límite", () => {
    const transactions = [tx("b"), tx("b"), tx("a")];
    const ranked = rankPayeesByUsage(payees, transactions, 3);
    expect(ranked.map((p) => p.id)).toEqual(["b", "a", "c"]);
  });

  it("sin ningún uso, cae al orden por id", () => {
    const ranked = rankPayeesByUsage(payees, [], 2);
    expect(ranked.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("ignora las transacciones sin comercio", () => {
    const transactions = [tx(null), tx(null), tx("c")];
    const ranked = rankPayeesByUsage(payees, transactions, 1);
    expect(ranked.map((p) => p.id)).toEqual(["c"]);
  });

  it("nunca duplica un comercio entre uso y relleno", () => {
    const transactions = [tx("c")];
    const ranked = rankPayeesByUsage(payees, transactions, 4);
    expect(new Set(ranked.map((p) => p.id)).size).toBe(4);
  });
});
