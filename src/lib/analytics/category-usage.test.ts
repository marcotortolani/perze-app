import { describe, expect, it } from "vitest";
import { countCategoryUsage, rankCategoriesByUsage, rankRecentCategoriesByUsage } from "./category-usage";
import type { CategoryRow, TransactionRow } from "@/lib/db/schema";

type Tx = Pick<TransactionRow, "categoryId" | "kind" | "occurredAt">;

function tx(categoryId: string, kind: "expense" | "income", occurredAt: string): Tx {
  return { categoryId, kind, occurredAt };
}

function category(id: string, sortOrder: number, kind: "expense" | "income" = "expense"): CategoryRow {
  return {
    id,
    householdId: "hh-1",
    parentId: null,
    name: id,
    i18nKey: null,
    icon: "tag",
    color: "var(--data-1)",
    kind,
    nature: "variable",
    isSystem: false,
    sortOrder,
    archivedAt: null,
    visibility: "household",
    ownerId: null,
    createdBy: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    clientRev: 1,
  };
}

describe("countCategoryUsage", () => {
  it("cuenta ocurrencias por categoría, ignorando el otro kind", () => {
    const usage = countCategoryUsage(
      [tx("food", "expense", "2026-07-01"), tx("food", "expense", "2026-07-02"), tx("transport", "expense", "2026-07-01"), tx("salary", "income", "2026-07-01")],
      { kind: "expense" }
    );
    expect(usage[0]).toMatchObject({ categoryId: "food", count: 2 });
    expect(usage.find((u) => u.categoryId === "salary")).toBeUndefined();
  });

  it("ordena por conteo desc y desempata por más reciente", () => {
    const usage = countCategoryUsage(
      [tx("a", "expense", "2026-01-01"), tx("b", "expense", "2026-07-01"), tx("b", "expense", "2026-07-10")],
      { kind: "expense" }
    );
    expect(usage.map((u) => u.categoryId)).toEqual(["b", "a"]);
  });

  it("respeta `since`", () => {
    const usage = countCategoryUsage([tx("a", "expense", "2026-01-01"), tx("a", "expense", "2026-07-01")], { kind: "expense", since: "2026-06-01" });
    expect(usage[0]).toMatchObject({ count: 1 });
  });
});

describe("rankCategoriesByUsage", () => {
  const categories = [category("food", 0), category("transport", 1), category("health", 2), category("other", 3)];

  it("prioriza uso real y rellena con sortOrder hasta el límite", () => {
    const usage = countCategoryUsage([tx("transport", "expense", "2026-07-01")], { kind: "expense" });
    const ranked = rankCategoriesByUsage(categories, usage, { kind: "expense", limit: 3 });
    expect(ranked.map((c) => c.id)).toEqual(["transport", "food", "health"]);
  });

  it("sin ningún uso, cae entero a sortOrder", () => {
    const ranked = rankCategoriesByUsage(categories, [], { kind: "expense", limit: 2 });
    expect(ranked.map((c) => c.id)).toEqual(["food", "transport"]);
  });

  it("nunca duplica una categoría entre uso y relleno", () => {
    const usage = countCategoryUsage([tx("food", "expense", "2026-07-01")], { kind: "expense" });
    const ranked = rankCategoriesByUsage(categories, usage, { kind: "expense", limit: 4 });
    expect(new Set(ranked.map((c) => c.id)).size).toBe(4);
  });
});

describe("rankRecentCategoriesByUsage", () => {
  const categories = [category("food", 0), category("transport", 1), category("health", 2)];
  const now = new Date("2026-07-31T00:00:00.000Z");

  it("una categoría muy usada hace más de 90 días no gana a una semanal reciente cuando hay suficientes recientes", () => {
    const transactions = [
      ...Array.from({ length: 20 }, () => tx("health", "expense", "2025-01-01")), // vieja, fuera de ventana
      tx("food", "expense", "2026-07-25"),
      tx("transport", "expense", "2026-07-20"),
    ];
    const ranked = rankRecentCategoriesByUsage(categories, transactions, { kind: "expense", limit: 2, now });
    expect(ranked.map((c) => c.id)).toEqual(["food", "transport"]);
  });

  it("un household nuevo sin historial reciente cae a histórico completo para llenar el límite", () => {
    const transactions = [tx("health", "expense", "2025-01-01")]; // solo uno, fuera de ventana de 90 días
    const ranked = rankRecentCategoriesByUsage(categories, transactions, { kind: "expense", limit: 3, now });
    expect(ranked).toHaveLength(3);
    expect(ranked.map((c) => c.id)).toContain("health");
  });

  it("un household sin ningún movimiento igual muestra `limit` categorías por sortOrder", () => {
    const ranked = rankRecentCategoriesByUsage(categories, [], { kind: "expense", limit: 3, now });
    expect(ranked.map((c) => c.id)).toEqual(["food", "transport", "health"]);
  });
});
