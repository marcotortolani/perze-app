import { describe, expect, it } from "vitest";
import { evaluateCategorizationRules } from "./categorization-rules";
import type { CategorizationRuleRow } from "../db/schema";

function rule(overrides: Partial<CategorizationRuleRow> = {}): CategorizationRuleRow {
  return {
    id: "r1",
    householdId: "hh1",
    name: "Uber → Transporte",
    priority: 0,
    match: { field: "note", op: "contains", value: "uber" },
    actions: { categoryId: "cat-transport", tagIds: [], payeeId: null },
    isActive: true,
    hitCount: 0,
    createdBy: "u1",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    deletedAt: null,
    ...overrides,
  };
}

describe("evaluateCategorizationRules", () => {
  it("matches a rule whose condition is contained in the note", () => {
    const result = evaluateCategorizationRules([rule()], { note: "Uber trip home", payeeName: null });
    expect(result?.id).toBe("r1");
  });

  it("is case-insensitive", () => {
    const result = evaluateCategorizationRules([rule()], { note: "UBER TRIP", payeeName: null });
    expect(result?.id).toBe("r1");
  });

  it("returns null when nothing matches", () => {
    const result = evaluateCategorizationRules([rule()], { note: "Supermarket", payeeName: null });
    expect(result).toBeNull();
  });

  it("ignores inactive rules", () => {
    const result = evaluateCategorizationRules([rule({ isActive: false })], { note: "Uber trip", payeeName: null });
    expect(result).toBeNull();
  });

  it("respects priority order, picking the highest first", () => {
    const low = rule({ id: "low", priority: 0, match: { field: "note", op: "contains", value: "market" } });
    const high = rule({ id: "high", priority: 10, match: { field: "note", op: "contains", value: "market" } });
    const result = evaluateCategorizationRules([low, high], { note: "Market run", payeeName: null });
    expect(result?.id).toBe("high");
  });

  it("matches on payeeName with equals op", () => {
    const r = rule({ match: { field: "payeeName", op: "equals", value: "Netflix" } });
    const result = evaluateCategorizationRules([r], { note: null, payeeName: "netflix" });
    expect(result?.id).toBe("r1");
  });
});
