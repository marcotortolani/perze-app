/**
 * Agregados de un período (H1, H1b): gasto diario, cashflow, tasa de
 * ahorro. Todo excluye `needs_fx` — nunca lo cuenta como si valiera 0
 * (CLAUDE.md § needs_fx) — y devuelve el conteo excluido para que la
 * pantalla lo declare.
 */

export interface PeriodTransactionInput {
  kind: "expense" | "income" | "transfer" | "adjustment" | "investing";
  amountBase: bigint | null;
  occurredAt: string;
}

export interface PeriodSummary {
  expenseTotal: bigint;
  incomeTotal: bigint;
  /** `incomeTotal - expenseTotal`. */
  cashflow: bigint;
  /** 0-100, `null` si no hay ingresos con los que calcularla. */
  savingsRatePct: number | null;
  /** Movimientos sin `amount_base` (needs_fx) dentro del rango — excluidos de todo lo de arriba. */
  excludedCount: number;
}

export function summarizePeriod(transactions: readonly PeriodTransactionInput[], from: Date, to: Date): PeriodSummary {
  let expenseTotal = 0n;
  let incomeTotal = 0n;
  let excludedCount = 0;

  for (const tx of transactions) {
    const occurred = new Date(tx.occurredAt);
    if (occurred < from || occurred >= to) continue;
    if (tx.kind === "transfer" || tx.kind === "adjustment") continue;
    if (tx.amountBase === null) {
      excludedCount += 1;
      continue;
    }
    if (tx.kind === "expense") expenseTotal += tx.amountBase;
    else incomeTotal += tx.amountBase;
  }

  const cashflow = incomeTotal - expenseTotal;
  const savingsRatePct = incomeTotal > 0n ? (Number(cashflow) / Number(incomeTotal)) * 100 : null;

  return { expenseTotal, incomeTotal, cashflow, savingsRatePct, excludedCount };
}

/** Gasto promedio por día del rango — para "Gasto diario" en H1a. */
export function averageDailyExpense(expenseTotal: bigint, days: number): bigint {
  if (days <= 0) return 0n;
  return expenseTotal / BigInt(days);
}
