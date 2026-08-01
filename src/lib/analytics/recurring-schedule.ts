/** G1 — próxima fecha de cobro de cada recurrente y comprometido en un horizonte de días. */

export interface RecurringRuleInput {
  id: string;
  kind: "expense" | "income";
  expectedAmount: bigint;
  dayOfMonth: number;
}

export interface UpcomingCharge {
  ruleId: string;
  nextDate: Date;
}

/** Próxima ocurrencia de una regla desde `now` — si el día ya pasó este mes, cae el mes que viene. Clampea a 28/29/30/31 según el mes real. */
export function nextOccurrence(dayOfMonth: number, now: Date): Date {
  const daysThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayThisMonth = Math.min(dayOfMonth, daysThisMonth);
  if (now.getDate() <= dayThisMonth) return new Date(now.getFullYear(), now.getMonth(), dayThisMonth);
  const daysNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate();
  return new Date(now.getFullYear(), now.getMonth() + 1, Math.min(dayOfMonth, daysNextMonth));
}

export function computeUpcomingCharges(rules: readonly RecurringRuleInput[], now: Date, horizonDays: number): UpcomingCharge[] {
  const horizonEnd = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  return rules
    .map((rule) => ({ ruleId: rule.id, nextDate: nextOccurrence(rule.dayOfMonth, now) }))
    .filter((charge) => charge.nextDate <= horizonEnd)
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());
}

/** Total mensual comprometido — suma de gastos esperados (los ingresos recurrentes no "comprometen" nada). */
export function computeMonthlyCommitted(rules: readonly RecurringRuleInput[]): bigint {
  return rules.filter((r) => r.kind === "expense").reduce((sum, r) => sum + r.expectedAmount, 0n);
}
