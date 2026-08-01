/**
 * H10 — insights automáticos (subconjunto del motor de reglas de
 * `docs/00-producto.md` § "Insights automáticos"): racha de días
 * registrando y ritmo de presupuesto proyectado. Detección de
 * suscripciones nuevas/aumentos de precio queda fuera de esta pasada:
 * necesita diffing de `recurring_rules` a través del tiempo, no solo el
 * estado actual.
 */

export interface StreakTransactionInput {
  occurredAt: string;
}

/** Días consecutivos (terminando hoy) con al menos un movimiento registrado. */
export function computeLoggingStreak(transactions: readonly StreakTransactionInput[], now: Date): number {
  const days = new Set(transactions.map((tx) => new Date(tx.occurredAt).toDateString()));
  let streak = 0;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface BudgetPaceInput {
  categoryId: string | null;
  amountLimit: bigint;
  spent: bigint;
}

export interface BudgetPaceInsight {
  categoryId: string | null;
  /** Día del mes (1-31, en la fecha real) proyectado de sobrepasar el presupuesto. */
  projectedOverspendDate: Date;
}

/**
 * Si el ritmo de gasto actual (gastado / días transcurridos) sigue
 * constante, ¿en qué fecha se cruza el límite? Solo se devuelve si esa
 * fecha cae DENTRO del período en curso — cruzar el límite después de que
 * cierre no es una alerta, es aritmética sin consecuencia.
 */
export function computeBudgetPaceInsights(budgets: readonly BudgetPaceInput[], periodStart: Date, periodEnd: Date, now: Date): BudgetPaceInsight[] {
  const elapsedMs = now.getTime() - periodStart.getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  if (elapsedDays <= 0) return [];

  const insights: BudgetPaceInsight[] = [];
  for (const budget of budgets) {
    if (budget.amountLimit <= 0n || budget.spent <= 0n) continue;
    const dailyRate = Number(budget.spent) / elapsedDays;
    if (dailyRate <= 0) continue;
    const daysToLimit = Number(budget.amountLimit) / dailyRate;
    const projectedOverspendDate = new Date(periodStart.getTime() + daysToLimit * 24 * 60 * 60 * 1000);
    if (projectedOverspendDate > now && projectedOverspendDate < periodEnd) {
      insights.push({ categoryId: budget.categoryId, projectedOverspendDate });
    }
  }
  return insights;
}
