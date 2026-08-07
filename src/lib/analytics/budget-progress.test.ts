import { describe, expect, it } from "vitest";
import { computeBudgetProgress, identifyBudgetAlerts } from "./budget-progress";

const periodStart = new Date(2026, 6, 1);
const periodEnd = new Date(2026, 7, 1);

describe("computeBudgetProgress", () => {
  it("sums expenses in-category within the period", () => {
    const result = computeBudgetProgress(
      { categoryId: "groceries", amountLimit: 10_000n },
      [
        { kind: "expense", categoryId: "groceries", amountBase: 4_000n, occurredAt: "2026-07-10" },
        { kind: "expense", categoryId: "groceries", amountBase: 2_000n, occurredAt: "2026-07-15" },
        { kind: "expense", categoryId: "transport", amountBase: 9_999n, occurredAt: "2026-07-10" },
        { kind: "expense", categoryId: "groceries", amountBase: 1_000n, occurredAt: "2026-06-30" },
      ],
      periodStart,
      periodEnd,
      []
    );
    expect(result.spent).toBe(6_000n);
    expect(result.progress).toBeCloseTo(0.6);
    expect(result.excludedCount).toBe(0);
  });

  it("sums across all categories for a household-wide budget (categoryId null)", () => {
    const result = computeBudgetProgress(
      { categoryId: null, amountLimit: 10_000n },
      [
        { kind: "expense", categoryId: "groceries", amountBase: 4_000n, occurredAt: "2026-07-10" },
        { kind: "expense", categoryId: "transport", amountBase: 2_000n, occurredAt: "2026-07-10" },
      ],
      periodStart,
      periodEnd,
      []
    );
    expect(result.spent).toBe(6_000n);
  });

  it("can exceed 1 when over budget", () => {
    const result = computeBudgetProgress(
      { categoryId: "groceries", amountLimit: 1_000n },
      [{ kind: "expense", categoryId: "groceries", amountBase: 1_500n, occurredAt: "2026-07-10" }],
      periodStart,
      periodEnd,
      []
    );
    expect(result.progress).toBeCloseTo(1.5);
  });

  it("excludes needs_fx transactions and counts them, never treating them as 0", () => {
    const result = computeBudgetProgress(
      { categoryId: "groceries", amountLimit: 1_000n },
      [
        { kind: "expense", categoryId: "groceries", amountBase: 500n, occurredAt: "2026-07-10" },
        { kind: "expense", categoryId: "groceries", amountBase: null, occurredAt: "2026-07-11" },
      ],
      periodStart,
      periodEnd,
      []
    );
    expect(result.spent).toBe(500n);
    expect(result.excludedCount).toBe(1);
  });

  it("un presupuesto en la categoría padre suma también el gasto de sus subcategorías", () => {
    const categories = [
      { id: "groceries", parentId: null },
      { id: "groceries-pantry", parentId: "groceries" },
      { id: "groceries-produce", parentId: "groceries" },
    ];
    const result = computeBudgetProgress(
      { categoryId: "groceries", amountLimit: 10_000n },
      [
        { kind: "expense", categoryId: "groceries", amountBase: 1_000n, occurredAt: "2026-07-10" },
        { kind: "expense", categoryId: "groceries-pantry", amountBase: 2_000n, occurredAt: "2026-07-10" },
        { kind: "expense", categoryId: "groceries-produce", amountBase: 500n, occurredAt: "2026-07-10" },
        { kind: "expense", categoryId: "transport", amountBase: 9_999n, occurredAt: "2026-07-10" },
      ],
      periodStart,
      periodEnd,
      categories
    );
    expect(result.spent).toBe(3_500n);
  });

  it("un presupuesto en una subcategoría específica no suma el resto de sus hermanas ni el padre", () => {
    const categories = [
      { id: "groceries", parentId: null },
      { id: "groceries-pantry", parentId: "groceries" },
      { id: "groceries-produce", parentId: "groceries" },
    ];
    const result = computeBudgetProgress(
      { categoryId: "groceries-pantry", amountLimit: 10_000n },
      [
        { kind: "expense", categoryId: "groceries", amountBase: 1_000n, occurredAt: "2026-07-10" },
        { kind: "expense", categoryId: "groceries-pantry", amountBase: 2_000n, occurredAt: "2026-07-10" },
        { kind: "expense", categoryId: "groceries-produce", amountBase: 500n, occurredAt: "2026-07-10" },
      ],
      periodStart,
      periodEnd,
      categories
    );
    expect(result.spent).toBe(2_000n);
  });
});

describe("identifyBudgetAlerts", () => {
  const budgets = [
    { categoryId: "groceries", amountLimit: 1_000n },
    { categoryId: "transport", amountLimit: 1_000n },
    { categoryId: "leisure", amountLimit: 1_000n },
  ];

  it("flags a budget at 80%+ as warning", () => {
    const transactions = [{ kind: "expense" as const, categoryId: "groceries", amountBase: 850n, occurredAt: "2026-07-10" }];
    const alerts = identifyBudgetAlerts(budgets, transactions, periodStart, periodEnd, []);
    expect(alerts).toEqual([{ budget: budgets[0], level: "warning", progress: 0.85 }]);
  });

  it("flags a budget past 100% as exceeded", () => {
    const transactions = [{ kind: "expense" as const, categoryId: "transport", amountBase: 1_200n, occurredAt: "2026-07-10" }];
    const alerts = identifyBudgetAlerts(budgets, transactions, periodStart, periodEnd, []);
    expect(alerts).toEqual([{ budget: budgets[1], level: "exceeded", progress: 1.2 }]);
  });

  it("does not flag budgets under 80%", () => {
    const transactions = [{ kind: "expense" as const, categoryId: "leisure", amountBase: 100n, occurredAt: "2026-07-10" }];
    expect(identifyBudgetAlerts(budgets, transactions, periodStart, periodEnd, [])).toEqual([]);
  });
});
