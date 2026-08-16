import type { CategoryRow } from "@/lib/db/schema";
import { periodBoundsAt } from "./history";
import { computeBudgetProgress, type BudgetTransactionInput } from "./budget-progress";
import { computeBudgetRollover, type BudgetRolloverInput } from "./budget-rollover";

export interface BudgetClosureStatus {
  /** Bajo el límite efectivo (felicitar) o por encima (motivar). */
  status: "under" | "over";
  spent: bigint;
  /** Límite efectivo que aplicó a ESE período — `amountLimit` + el arrastre que tenía en ese momento. */
  effectiveLimit: bigint;
  excludedCount: number;
  periodEnd: Date;
}

/**
 * Cómo cerró el ÚLTIMO período completo de un presupuesto — para el banner
 * de cierre de período, que aplica a TODOS los presupuestos, tengan
 * rollover activado o no. El límite contra el que se compara es el que de
 * verdad rigió ese período: si el presupuesto tiene rollover, es
 * `amountLimit` más el arrastre acumulado HASTA (sin incluir) ese período
 * — no el arrastre de hoy, que ya le suma el resultado del período que
 * estamos evaluando.
 *
 * Se logra pidiéndole a `computeBudgetRollover` el arrastre "como si hoy
 * fuera el inicio del último período cerrado" — con esa fecha como `now`,
 * itera los períodos ANTERIORES a ese, que es exactamente lo que hacía
 * falta.
 */
export function computeBudgetClosureStatus(
  budget: BudgetRolloverInput,
  allTransactionsInRange: readonly BudgetTransactionInput[],
  periodStartDay: number,
  now: Date,
  categories: readonly Pick<CategoryRow, "id" | "parentId">[]
): BudgetClosureStatus {
  const lastClosed = periodBoundsAt(periodStartDay, now, -1);
  const { carry: carryBeforeLastClosed } = computeBudgetRollover(budget, allTransactionsInRange, periodStartDay, lastClosed.start, categories);
  const effectiveLimit = budget.amountLimit + carryBeforeLastClosed;
  const progress = computeBudgetProgress({ ...budget, amountLimit: effectiveLimit }, allTransactionsInRange, lastClosed.start, lastClosed.end, categories);

  return {
    status: progress.spent > effectiveLimit ? "over" : "under",
    spent: progress.spent,
    effectiveLimit,
    excludedCount: progress.excludedCount,
    periodEnd: lastClosed.end,
  };
}

export interface BudgetClosureCandidate<TBudget extends BudgetRolloverInput> {
  budget: TBudget;
  closure: BudgetClosureStatus;
  /** `|spent/effectiveLimit - 1|` — qué tan lejos del límite terminó, para elegir cuál mostrar cuando hay varios presupuestos. */
  deviation: number;
}

/**
 * Entre todos los presupuestos activos, el candidato para el banner de
 * cierre de período es el de MAYOR DESVÍO — el que terminó más lejos de su
 * límite en cualquier dirección (más excedido o más subgastado), medido
 * como fracción del límite (`|spent/effectiveLimit - 1|`) para poder
 * comparar presupuestos en distintas monedas o de distinto tamaño sin que
 * el de mayor monto absoluto gane siempre. Es una decisión de producto no
 * especificada en el encargo — documentada acá porque es la única función
 * que la toma.
 */
export function pickBudgetClosureCandidate<TBudget extends BudgetRolloverInput>(
  budgets: readonly TBudget[],
  allTransactionsInRange: readonly BudgetTransactionInput[],
  periodStartDay: number,
  now: Date,
  categories: readonly Pick<CategoryRow, "id" | "parentId">[]
): BudgetClosureCandidate<TBudget> | null {
  let best: BudgetClosureCandidate<TBudget> | null = null;
  for (const budget of budgets) {
    const closure = computeBudgetClosureStatus(budget, allTransactionsInRange, periodStartDay, now, categories);
    if (closure.effectiveLimit <= 0n) continue;
    const deviation = Math.abs(Number(closure.spent) / Number(closure.effectiveLimit) - 1);
    if (!best || deviation > best.deviation) best = { budget, closure, deviation };
  }
  return best;
}
