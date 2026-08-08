import { computeTransactionEffects, type TransactionForEffects } from "../repos/balance-effects";
import { averageDailyExpense, summarizePeriod } from "./period-summary";

export interface GoalFlowTransaction extends TransactionForEffects {
  occurredAt: string;
}

/**
 * F6 — ritmo real de aportes a una meta: neto de los movimientos de la
 * cuenta vinculada en los últimos `months` meses, dividido por mes. Usa
 * `computeTransactionEffects` (la misma función que mantiene
 * `current_balance`) para no reinventar qué mueve el saldo de una cuenta.
 */
export function computeContributionRate(transactions: readonly GoalFlowTransaction[], accountId: string, now: Date, months: number): bigint {
  const start = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  let net = 0n;
  for (const tx of transactions) {
    const occurred = new Date(tx.occurredAt);
    if (occurred < start || occurred > now) continue;
    for (const effect of computeTransactionEffects(tx)) {
      if (effect.accountId === accountId) net += effect.delta;
    }
  }
  return net / BigInt(months);
}

/** Fecha estimada de llegada si el ritmo mensual se mantiene constante — `null` si el ritmo es cero o negativo (nunca se llega). */
export function projectArrivalDate(saved: bigint, target: bigint, monthlyRate: bigint, now: Date): Date | null {
  const remaining = target - saved;
  if (remaining <= 0n) return now;
  if (monthlyRate <= 0n) return null;
  const monthsNeeded = Number(remaining) / Number(monthlyRate);
  return new Date(now.getFullYear(), now.getMonth() + Math.ceil(monthsNeeded), now.getDate());
}

/**
 * F7 — "colchón de 3 meses": 3x el gasto diario promedio de los últimos 90
 * días, la sugerencia que ofrece la pantalla de nueva meta cuando el
 * usuario no sabe cuánto poner.
 */
export function computeThreeMonthCushion(transactions: readonly { kind: "expense" | "income" | "transfer" | "adjustment" | "investing"; amountBase: bigint | null; occurredAt: string }[], now: Date): bigint {
  const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const summary = summarizePeriod(transactions, start, now);
  const dailyAvg = averageDailyExpense(summary.expenseTotal, 90);
  return dailyAvg * 90n;
}
