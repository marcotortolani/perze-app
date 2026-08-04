import { describe, expect, it } from "vitest";
import { computeUpcomingCharges, nextOccurrence, type RecurringRuleInput } from "./recurring-schedule";

function rule(overrides: Partial<RecurringRuleInput>): RecurringRuleInput {
  return {
    id: "a",
    kind: "expense",
    expectedAmount: 100n,
    currencyCode: "ARS",
    frequency: "monthly",
    anchorDate: "2026-01-01",
    dayOfMonth: 1,
    endDate: null,
    ...overrides,
  };
}

describe("nextOccurrence", () => {
  it("devuelve la próxima ocurrencia estricta después de una fecha", () => {
    expect(nextOccurrence(rule({ anchorDate: "2026-07-01", dayOfMonth: 15 }), "2026-07-10")).toBe("2026-07-15");
  });

  it("null cuando la regla ya terminó", () => {
    expect(nextOccurrence(rule({ anchorDate: "2026-07-01", dayOfMonth: 1, endDate: "2026-07-01" }), "2026-07-01")).toBeNull();
  });
});

describe("computeUpcomingCharges", () => {
  it("incluye los vencimientos dentro del horizonte, ordenados por fecha", () => {
    const now = new Date(2026, 6, 10);
    const rules = [
      rule({ id: "a", anchorDate: "2026-01-25", dayOfMonth: 25 }),
      rule({ id: "b", anchorDate: "2026-01-12", dayOfMonth: 12 }),
    ];
    const result = computeUpcomingCharges(rules, now, 30);
    expect(result.map((c) => c.ruleId)).toEqual(["b", "a"]);
  });

  it("excluye los vencimientos más allá del horizonte", () => {
    const now = new Date(2026, 6, 1);
    const rules = [rule({ id: "a", anchorDate: "2026-01-28", dayOfMonth: 28 })];
    expect(computeUpcomingCharges(rules, now, 7)).toEqual([]);
  });

  it("una regla semanal aparece dentro del horizonte aunque el ancla sea vieja", () => {
    const now = new Date(2026, 6, 10);
    const rules = [rule({ id: "a", frequency: "weekly", anchorDate: "2026-01-01", dayOfMonth: null })];
    const result = computeUpcomingCharges(rules, now, 7);
    expect(result).toHaveLength(1);
  });
});

// `computeMonthlyCommitted` es async (necesita resolver FX) — se prueba en
// `recurring-schedule-committed.test.ts`, no acá, para no arrastrar mocks
// de Dexie/fx a este archivo de fechas puras.
