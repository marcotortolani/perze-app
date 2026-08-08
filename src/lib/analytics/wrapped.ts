import { classifyCashFlow } from "./cash-flow";

/**
 * H12 — Wrapped del semestre. Solo se ofrece con 6 períodos cerrados (el
 * propio diseño lo declara: "el wrapped sólo se ofrece con 6 meses
 * cumplidos"). Una cifra por frame, sin gráficos — así que no hay mínimo
 * de historial de gráfico en juego, el gate es sobre la cifra en sí.
 *
 * `totalIncome`/`totalExpense` incluyen ventas y compras de instrumentos
 * (`cash-flow.ts`) — el ranking de comercios (`topPayee`) sigue restringido
 * a `kind === "expense"`, un trade no tiene payee.
 */

export interface WrappedTransactionInput {
  kind: "expense" | "income" | "transfer" | "adjustment" | "investing";
  occurredAt: string;
  amountBase: bigint | null;
  payeeId: string | null;
}

export interface WrappedSummary {
  transactionCount: number;
  excludedCount: number;
  totalIncome: bigint;
  totalExpense: bigint;
  savingsRatePct: number | null;
  daysActive: number;
  topPayee: { payeeId: string; visits: number; total: bigint } | null;
}

export function computeWrappedSummary(transactions: readonly WrappedTransactionInput[], periodStart: Date, periodEnd: Date): WrappedSummary {
  const inPeriod = transactions.filter((tx) => {
    const occurred = new Date(tx.occurredAt);
    return occurred >= periodStart && occurred < periodEnd;
  });

  let totalIncome = 0n;
  let totalExpense = 0n;
  let excludedCount = 0;
  let transactionCount = 0;
  const activeDays = new Set<string>();
  const byPayee = new Map<string, { payeeId: string; visits: number; total: bigint }>();

  for (const tx of inPeriod) {
    const { bucket, magnitude } = classifyCashFlow(tx);
    if (bucket === "structural") continue; // transfer/adjustment, o el placeholder needs_capture_fx
    transactionCount += 1;
    activeDays.add(new Date(tx.occurredAt).toDateString());
    if (bucket === "needsFx") {
      excludedCount += 1;
      continue;
    }
    if (bucket === "inflow") totalIncome += magnitude;
    else {
      totalExpense += magnitude;
      if (tx.kind === "expense" && tx.payeeId) {
        const entry = byPayee.get(tx.payeeId) ?? { payeeId: tx.payeeId, visits: 0, total: 0n };
        entry.visits += 1;
        entry.total += magnitude;
        byPayee.set(tx.payeeId, entry);
      }
    }
  }

  const savingsRatePct = totalIncome > 0n ? (Number(totalIncome - totalExpense) / Number(totalIncome)) * 100 : null;
  const topPayee = [...byPayee.values()].sort((a, b) => b.visits - a.visits)[0] ?? null;

  return { transactionCount, excludedCount, totalIncome, totalExpense, savingsRatePct, daysActive: activeDays.size, topPayee };
}
