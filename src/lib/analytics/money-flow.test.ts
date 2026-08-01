import { describe, expect, it } from "vitest";
import { computeMoneyFlow, type MoneyFlowTransaction } from "./money-flow";

const labels = {
  categoryLabel: (id: string) => `cat:${id}`,
  accountLabel: (id: string) => `acc:${id}`,
  otherIncome: "Otros ingresos",
  otherExpense: "Otros gastos",
};

describe("computeMoneyFlow", () => {
  it("links income category to account and account to expense category", () => {
    const txs: MoneyFlowTransaction[] = [
      { kind: "income", accountId: "a1", categoryId: "salary", amountBase: 1000n },
      { kind: "expense", accountId: "a1", categoryId: "food", amountBase: 400n },
    ];
    const result = computeMoneyFlow(txs, labels);
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["account:a1", "expense:food", "income:salary"]);
    expect(result.links).toEqual([
      { source: "income:salary", target: "account:a1", value: 1000 },
      { source: "account:a1", target: "expense:food", value: 400 },
    ]);
    expect(result.excludedCount).toBe(0);
  });

  it("counts needs_fx transactions without including them", () => {
    const txs: MoneyFlowTransaction[] = [
      { kind: "income", accountId: "a1", categoryId: "salary", amountBase: null },
      { kind: "expense", accountId: "a1", categoryId: "food", amountBase: 100n },
    ];
    const result = computeMoneyFlow(txs, labels);
    expect(result.excludedCount).toBe(1);
    expect(result.links).toEqual([{ source: "account:a1", target: "expense:food", value: 100 }]);
  });

  it("ignores transfer and adjustment kinds", () => {
    const txs: MoneyFlowTransaction[] = [
      { kind: "transfer", accountId: "a1", categoryId: null, amountBase: 500n },
      { kind: "adjustment", accountId: "a1", categoryId: null, amountBase: 500n },
    ];
    const result = computeMoneyFlow(txs, labels);
    expect(result.links).toEqual([]);
    expect(result.nodes).toEqual([]);
  });

  it("collapses categories beyond the top 5 into an 'other' node", () => {
    const txs: MoneyFlowTransaction[] = Array.from({ length: 7 }, (_, i) => ({
      kind: "expense" as const,
      accountId: "a1",
      categoryId: `cat${i}`,
      amountBase: BigInt(100 - i),
    }));
    const result = computeMoneyFlow(txs, labels);
    const expenseNodes = result.nodes.filter((n) => n.column === 2);
    expect(expenseNodes).toHaveLength(6); // top 5 + "otros"
    const otherLink = result.links.find((l) => l.target === "expense:__other");
    expect(otherLink?.value).toBe(95 + 94); // cat5 (95) + cat6 (94) collapsed — lowest two
  });

  it("merges multiple accounts feeding the same category into one link value", () => {
    const txs: MoneyFlowTransaction[] = [
      { kind: "expense", accountId: "a1", categoryId: "food", amountBase: 100n },
      { kind: "expense", accountId: "a1", categoryId: "food", amountBase: 50n },
    ];
    const result = computeMoneyFlow(txs, labels);
    expect(result.links).toEqual([{ source: "account:a1", target: "expense:food", value: 150 }]);
  });
});
