import type { HouseholdRow } from "@/lib/db/schema";
import { resolveFxForAccountCurrency } from "@/features/capture/save-transaction";
import { todayIso } from "@/lib/dates/today";
import { money } from "@/lib/money/money";
import { monthlyEquivalent, nextOccurrenceAfter, occurredAtFor, occurrencesBetween, type OccurrenceRule } from "@/lib/recurring/occurrences";

/** G1 — próximos vencimientos y comprometido mensual de las reglas recurrentes. */

export interface RecurringRuleInput extends OccurrenceRule {
  id: string;
  kind: "expense" | "income";
  expectedAmount: bigint;
  currencyCode: string;
}

export interface UpcomingCharge {
  ruleId: string;
  nextDate: Date;
}

/**
 * `now` de referencia como fecha-sin-hora (día calendario LOCAL, con
 * `y/m/d` de `Date` — no `toISOString()`, que es UTC y adelanta/atrasa el
 * día según el huso — D10). `nextDate` se construye con `occurredAtFor`
 * (mediodía UTC) para que cualquier formateo posterior por zona horaria
 * local siga cayendo en el día calendario correcto.
 */
export function computeUpcomingCharges(rules: readonly RecurringRuleInput[], now: Date, horizonDays: number): UpcomingCharge[] {
  const fromIso = localDateOnly(now);
  const toIso = localDateOnly(new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000));
  return rules
    .flatMap((rule) => {
      const [first] = occurrencesBetween(rule, fromIso, toIso);
      if (!first) return [];
      return [{ ruleId: rule.id, nextDate: new Date(occurredAtFor(first)) }];
    })
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());
}

function localDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Próxima ocurrencia de una regla, o `null` si ya terminó — wrapper delgado sobre `nextOccurrenceAfter`. */
export function nextOccurrence(rule: RecurringRuleInput, afterIso: string): string | null {
  return nextOccurrenceAfter(rule, afterIso);
}

export interface MonthlyCommitted {
  /** En `household.baseCurrency`, ya con needs_fx excluido. */
  total: bigint;
  /** Reglas de gasto cuya conversión no se pudo resolver — nunca se suman como si valieran 0. */
  excludedCount: number;
}

/**
 * Total mensual comprometido — suma de gastos esperados, normalizados por
 * frecuencia (`monthlyEquivalent`) y convertidos a la moneda base
 * (`resolveFxForAccountCurrency`, la misma cadena que cualquier captura:
 * override → cotización del día → última conocida → `pending`, nunca
 * `rate = 1` inventado). D03/D03b: antes esto sumaba `bigint` de monedas
 * distintas como si fueran la misma — un número sin significado. Los
 * ingresos recurrentes no "comprometen" nada, se excluyen.
 */
export async function computeMonthlyCommitted(household: HouseholdRow, rules: readonly RecurringRuleInput[]): Promise<MonthlyCommitted> {
  const today = todayIso();
  let total = 0n;
  let excludedCount = 0;

  for (const rule of rules) {
    if (rule.kind !== "expense") continue;
    const monthly = monthlyEquivalent(rule.expectedAmount, rule.frequency);
    const fx = await resolveFxForAccountCurrency(household, rule.currencyCode, money(monthly, rule.currencyCode), today);
    if (fx.amountBase === null) {
      excludedCount += 1;
      continue;
    }
    total += fx.amountBase;
  }

  return { total, excludedCount };
}
