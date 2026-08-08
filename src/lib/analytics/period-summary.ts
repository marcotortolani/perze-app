import { classifyCashFlow, classifyConsumption } from "./cash-flow";
import type { TransactionKind } from "@/lib/db/schema";

/**
 * Agregados de un período (H1, H1b): gasto diario, cashflow, tasa de
 * ahorro. Todo excluye `needs_fx` — nunca lo cuenta como si valiera 0
 * (CLAUDE.md § needs_fx) — y devuelve el conteo excluido para que la
 * pantalla lo declare.
 *
 * Dos pares de totales, porque responden preguntas distintas
 * (`src/lib/analytics/cash-flow.ts`):
 * - `inflowTotal`/`outflowTotal`: ¿movió liquidez? Compras y ventas de
 *   instrumentos cuentan — es la misma plata que financia el resto del mes.
 *   `cashflow` y `savingsRatePct` derivan de este par.
 * - `expenseTotal`/`incomeTotal`: ¿fue consumo? Las inversiones NO cuentan.
 *   Sigue siendo el par que usan "Gasto diario" (H1a) y el ajuste por
 *   inflación — comprar acciones no es gasto.
 */

export interface PeriodTransactionInput {
  kind: TransactionKind;
  amountBase: bigint | null;
  occurredAt: string;
}

export interface PeriodSummary {
  /** Solo consumo — para "Gasto diario" y el ajuste por inflación. */
  expenseTotal: bigint;
  /** Solo consumo. */
  incomeTotal: bigint;
  /** Toda la liquidez que salió, consumo + inversión. */
  outflowTotal: bigint;
  /** Toda la liquidez que entró, consumo + inversión. */
  inflowTotal: bigint;
  /** `inflowTotal - outflowTotal`. */
  cashflow: bigint;
  /** 0-100, `null` si no hay ingresos con los que calcularla. */
  savingsRatePct: number | null;
  /** Movimientos sin `amount_base` (needs_fx) dentro del rango — excluidos de todo lo de arriba. */
  excludedCount: number;
}

export function summarizePeriod(transactions: readonly PeriodTransactionInput[], from: Date, to: Date): PeriodSummary {
  let expenseTotal = 0n;
  let incomeTotal = 0n;
  let outflowTotal = 0n;
  let inflowTotal = 0n;
  let excludedCount = 0;

  for (const tx of transactions) {
    const occurred = new Date(tx.occurredAt);
    if (occurred < from || occurred >= to) continue;

    const flow = classifyCashFlow(tx);
    if (flow.bucket === "needsFx") {
      excludedCount += 1;
      continue;
    }
    if (flow.bucket === "outflow") outflowTotal += flow.magnitude;
    else if (flow.bucket === "inflow") inflowTotal += flow.magnitude;

    const consumption = classifyConsumption(tx);
    if (consumption.bucket === "outflow") expenseTotal += consumption.magnitude;
    else if (consumption.bucket === "inflow") incomeTotal += consumption.magnitude;
  }

  const cashflow = inflowTotal - outflowTotal;
  const savingsRatePct = inflowTotal > 0n ? (Number(cashflow) / Number(inflowTotal)) * 100 : null;

  return { expenseTotal, incomeTotal, outflowTotal, inflowTotal, cashflow, savingsRatePct, excludedCount };
}

/** Gasto promedio por día del rango — para "Gasto diario" en H1a. Solo consumo, nunca inversión. */
export function averageDailyExpense(expenseTotal: bigint, days: number): bigint {
  if (days <= 0) return 0n;
  return expenseTotal / BigInt(days);
}
