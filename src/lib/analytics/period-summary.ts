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

export interface CategoryExpense {
  categoryId: string;
  total: bigint;
}

export interface ExpenseByCategory {
  /** De mayor a menor gasto. Solo consumo: comprar un instrumento no es gasto. */
  categories: CategoryExpense[];
  /** Movimientos sin `amount_base` dentro del rango — excluidos del desglose. */
  excludedCount: number;
  /** Gastos sin categoría — no entran en el desglose pero sí existieron. */
  uncategorizedTotal: bigint;
}

/**
 * Gasto por categoría en un rango, de mayor a menor.
 *
 * Estaba inline en `(app)/analytics/categories/page.tsx` y hacía falta de
 * nuevo para el resumen por mail. Se extrae en vez de copiarse: es
 * exactamente el patrón que ya salió caro en este proyecto — la regla de
 * signo por `kind` llegó a estar reimplementada doce veces, tres de ellas
 * con el signo mal (ver `cash-flow.ts`).
 *
 * Devuelve `excludedCount` porque todo agregado tiene que poder declarar
 * qué dejó afuera (`CLAUDE.md` § needs_fx). La versión inline no lo hacía:
 * los movimientos sin cotización desaparecían del gráfico sin que nada lo
 * dijera.
 *
 * El agrupado "top 5 + Otros" NO vive acá: eso es presentación, y la regla
 * de 5 slots de la paleta es del design system, no del cálculo.
 */
export function expenseByCategory(
  transactions: readonly (PeriodTransactionInput & { categoryId: string | null })[],
  from: Date,
  to: Date
): ExpenseByCategory {
  const byCategory = new Map<string, bigint>();
  let excludedCount = 0;
  let uncategorizedTotal = 0n;

  for (const tx of transactions) {
    const occurred = new Date(tx.occurredAt);
    if (occurred < from || occurred >= to) continue;

    // El conteo de excluidos mira el flujo, no el consumo: un movimiento
    // sin cotización está excluido de todo, sea o no consumo.
    if (classifyCashFlow(tx).bucket === "needsFx") {
      excludedCount += 1;
      continue;
    }

    const { bucket, magnitude } = classifyConsumption(tx);
    if (bucket !== "outflow") continue;

    if (!tx.categoryId) {
      uncategorizedTotal += magnitude;
      continue;
    }
    byCategory.set(tx.categoryId, (byCategory.get(tx.categoryId) ?? 0n) + magnitude);
  }

  const categories = [...byCategory.entries()]
    .map(([categoryId, total]) => ({ categoryId, total }))
    .sort((a, b) => (b.total > a.total ? 1 : b.total < a.total ? -1 : 0));

  return { categories, excludedCount, uncategorizedTotal };
}

export interface PeriodComparison {
  /** Diferencia absoluta contra el período anterior. Positivo = gastaste más. */
  expenseDelta: bigint;
  /** Variación porcentual, `null` si el período anterior fue 0 (dividir por cero no es "infinito%", es "no comparable"). */
  expensePct: number | null;
  incomeDelta: bigint;
  incomePct: number | null;
}

/**
 * Compara dos períodos ya resumidos. Se compara el par de CONSUMO
 * (`expenseTotal`/`incomeTotal`), no el de liquidez: "gastaste 12% más que
 * el mes pasado" con una compra de instrumentos adentro sería una lectura
 * falsa — comprar acciones no es gastar.
 *
 * Sin período anterior comparable (cero), el porcentaje es `null` y no 0
 * ni infinito: la pantalla decide cómo decir "no hay con qué comparar",
 * que es distinto de "no cambió".
 */
export function comparePeriods(current: PeriodSummary, previous: PeriodSummary): PeriodComparison {
  const pct = (now: bigint, before: bigint): number | null => (before === 0n ? null : (Number(now - before) / Number(before)) * 100);
  return {
    expenseDelta: current.expenseTotal - previous.expenseTotal,
    expensePct: pct(current.expenseTotal, previous.expenseTotal),
    incomeDelta: current.incomeTotal - previous.incomeTotal,
    incomePct: pct(current.incomeTotal, previous.incomeTotal),
  };
}

/** Gasto promedio por día del rango — para "Gasto diario" en H1a. Solo consumo, nunca inversión. */
export function averageDailyExpense(expenseTotal: bigint, days: number): bigint {
  if (days <= 0) return 0n;
  return expenseTotal / BigInt(days);
}
