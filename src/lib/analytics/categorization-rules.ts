import type { CategorizationRuleRow, RuleMatch } from "../db/schema";

export interface RuleEvaluationInput {
  note: string | null;
  payeeName: string | null;
}

function matchesCondition(match: RuleMatch, input: RuleEvaluationInput): boolean {
  const fieldValue = (match.field === "note" ? input.note : input.payeeName) ?? "";
  const needle = match.value.toLowerCase();
  const haystack = fieldValue.toLowerCase();
  return match.op === "contains" ? haystack.includes(needle) : haystack === needle;
}

/**
 * K7 — evalúa las reglas activas en orden de prioridad y devuelve la
 * primera que matchea. Solo se llama cuando la captura no trae categoría
 * propia: una elección explícita del usuario nunca se pisa con una regla.
 */
export function evaluateCategorizationRules(rules: readonly CategorizationRuleRow[], input: RuleEvaluationInput): CategorizationRuleRow | null {
  const active = rules.filter((r) => r.isActive && r.deletedAt === null).sort((a, b) => b.priority - a.priority);
  for (const rule of active) {
    if (matchesCondition(rule.match, input)) return rule;
  }
  return null;
}
