/**
 * Cuánto gastó el household contra un presupuesto, en el período en curso
 * (no un período cerrado — un presupuesto tiene que poder verse mientras
 * el mes todavía corre). `null` en `categoryId` significa el household
 * entero. Excluye `needs_fx` de la misma forma que cualquier otro
 * agregado — nunca lo cuenta como si valiera 0.
 */

export interface BudgetProgressInput {
  categoryId: string | null;
  amountLimit: bigint;
}

export interface BudgetTransactionInput {
  kind: "expense" | "income" | "transfer" | "adjustment";
  categoryId: string | null;
  amountBase: bigint | null;
  occurredAt: string;
}

export interface BudgetProgress {
  spent: bigint;
  /** `spent / amountLimit`, puede superar 1. */
  progress: number;
  excludedCount: number;
}

export function computeBudgetProgress(budget: BudgetProgressInput, transactions: readonly BudgetTransactionInput[], periodStart: Date, periodEnd: Date): BudgetProgress {
  let spent = 0n;
  let excludedCount = 0;

  for (const tx of transactions) {
    if (tx.kind !== "expense") continue;
    const occurred = new Date(tx.occurredAt);
    if (occurred < periodStart || occurred >= periodEnd) continue;
    if (budget.categoryId !== null && tx.categoryId !== budget.categoryId) continue;
    if (tx.amountBase === null) {
      excludedCount += 1;
      continue;
    }
    spent += tx.amountBase;
  }

  const progress = budget.amountLimit > 0n ? Number(spent) / Number(budget.amountLimit) : 0;
  return { spent, progress, excludedCount };
}

export type BudgetAlertLevel = "warning" | "exceeded";

export interface BudgetAlert<TBudget extends BudgetProgressInput> {
  budget: TBudget;
  level: BudgetAlertLevel;
  progress: number;
}

const WARNING_THRESHOLD = 0.8;

/** F4 — presupuestos al 80% ("warning") o pasados el 100% ("exceeded"), para el badge de tab, el insight de Home y el push. */
export function identifyBudgetAlerts<TBudget extends BudgetProgressInput>(
  budgets: readonly TBudget[],
  transactions: readonly BudgetTransactionInput[],
  periodStart: Date,
  periodEnd: Date
): BudgetAlert<TBudget>[] {
  const alerts: BudgetAlert<TBudget>[] = [];
  for (const budget of budgets) {
    const { progress } = computeBudgetProgress(budget, transactions, periodStart, periodEnd);
    if (progress >= 1) alerts.push({ budget, level: "exceeded", progress });
    else if (progress >= WARNING_THRESHOLD) alerts.push({ budget, level: "warning", progress });
  }
  return alerts;
}
