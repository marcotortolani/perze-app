import { type Money, subtract } from "@/lib/money/money";

export interface ReconcileDiffInput {
  /** Lo que el usuario tipeó como saldo real (según el banco/billetera). */
  bankBalance: Money;
  /** `account.currentBalance` — el saldo que la app ya tiene registrado. */
  currentBalance: Money;
  /** El keypad vacío ("") es distinto de "0" tipeado a propósito. */
  expr: string;
}

export interface ReconcileDiffResult {
  diff: Money;
  /**
   * Solo hay diferencia real si el usuario tipeó algo y ese algo no
   * coincide con lo que la cuenta ya muestra. Antes del fix de
   * `20260811220000_accounts_recompute_on_insert.sql`, `currentBalance`
   * podía estar mintiendo (0 en vez del saldo inicial real), así que esta
   * misma cuenta calculaba una diferencia fantasma contra un piso
   * equivocado y generaba un ajuste duplicado — el bug no estaba en esta
   * resta, estaba en qué valor le llegaba como `currentBalance`.
   */
  hasDiff: boolean;
}

/** Cálculo puro de la diferencia de conciliación — sin DOM, testeable. */
export function computeReconcileDiff({ bankBalance, currentBalance, expr }: ReconcileDiffInput): ReconcileDiffResult {
  const diff = subtract(bankBalance, currentBalance);
  const hasDiff = expr.trim() !== "" && diff.amount !== 0n;
  return { diff, hasDiff };
}
