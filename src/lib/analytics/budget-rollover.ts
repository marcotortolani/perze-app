import type { CategoryRow } from "@/lib/db/schema";
import { periodBoundsAt } from "./history";
import {
  computeBudgetProgress,
  type BudgetAlert,
  type BudgetAlertLevel,
  type BudgetProgressInput,
  type BudgetTransactionInput,
} from "./budget-progress";

/**
 * Rollover de presupuesto — opt-in por presupuesto, dos flags
 * independientes: `rolloverSurplus` arrastra el sobrante (lo no gastado)
 * al próximo período, `rolloverDeficit` arrastra el exceso (restando del
 * límite del próximo período). Los dos apagados por default. Aplica desde
 * que se activa hacia adelante, nunca retroactivo: `rolloverSince` ancla
 * la fecha, y solo se acumulan períodos que arrancaron en o después de esa
 * fecha.
 */
export interface BudgetRolloverInput extends BudgetProgressInput {
  rolloverSurplus: boolean;
  rolloverDeficit: boolean;
  rolloverSince: string | null;
}

export interface BudgetRolloverResult {
  /** Cuánto se suma (positivo) o resta (negativo) al límite del período en curso. */
  carry: bigint;
  /** `needs_fx` de los períodos cerrados que entraron en el cálculo del arrastre — se SUMA al del período en curso, nunca se muestra por separado. */
  excludedCount: number;
}

/**
 * `carry_0 = 0`, `carry_i = clamp(amountLimit + carry_{i-1} - spent_i)`.
 * El clamp depende de los flags:
 *   - ambos activos → sin recorte, el arrastre puede ir para cualquier lado.
 *   - solo `rolloverSurplus` → `max(0n, x)`: el déficit NO se arrastra, se
 *     resetea a 0 (un mes que se pasó no le come presupuesto al siguiente).
 *   - solo `rolloverDeficit` → `min(0n, x)`: el sobrante NO se arrastra, se
 *     resetea a 0 (un mes que ahorró no "regala" cupo extra al siguiente).
 *   - ninguno → siempre 0 (el caller nunca debería llamar con los dos en
 *     `false`, pero clampear a 0 igual es lo seguro).
 */
function clampCarry(value: bigint, rolloverSurplus: boolean, rolloverDeficit: boolean): bigint {
  if (rolloverSurplus && rolloverDeficit) return value;
  if (rolloverSurplus) return value > 0n ? value : 0n;
  if (rolloverDeficit) return value < 0n ? value : 0n;
  return 0n;
}

/**
 * Arrastre acumulado de un presupuesto desde `rolloverSince` hasta el
 * período en curso (sin contarlo — el arrastre se aplica AL período en
 * curso, no lo incluye en su propio cálculo). Itera los períodos cerrados
 * en ese rango con `computeBudgetProgress()` sobre transacciones que el
 * caller ya tiene en memoria — sin round-trip de red.
 *
 * Solo se cuentan períodos cuyo inicio es ≥ `rolloverSince`: si el flag se
 * activó a mitad de un período, ese período (y los anteriores) queda
 * afuera del arrastre — es la forma concreta de "nunca retroactivo".
 *
 * El `excludedCount` de cada período cerrado que entra en el cálculo se
 * ACUMULA acá: un arrastre calculado sobre datos parciales (con
 * movimientos sin cotización afuera) es tan parcial como el gastado del
 * mes, así que el usuario tiene que ver ese conteo igual que vería el del
 * período en curso — el caller lo suma al suyo, nunca lo descarta.
 */
export function computeBudgetRollover(
  budget: BudgetRolloverInput,
  allTransactionsInRange: readonly BudgetTransactionInput[],
  periodStartDay: number,
  now: Date,
  categories: readonly Pick<CategoryRow, "id" | "parentId">[]
): BudgetRolloverResult {
  if ((!budget.rolloverSurplus && !budget.rolloverDeficit) || !budget.rolloverSince) {
    return { carry: 0n, excludedCount: 0 };
  }

  // `periodBoundsAt` construye sus límites con el constructor LOCAL de
  // `Date` (año, mes, día) — para comparar `since` contra esos límites sin
  // el desfasaje de huso que produciría parsear el string como UTC (el
  // mismo bug de "31 de agosto" que documenta `CLAUDE.md`), se arma acá
  // con el mismo constructor local a partir de los componentes del ISO.
  const [sinceYear, sinceMonth, sinceDay] = budget.rolloverSince.split("-").map(Number) as [number, number, number];
  const since = new Date(sinceYear, sinceMonth - 1, sinceDay);
  const closedPeriods: { start: Date; end: Date }[] = [];
  for (let offset = -1; ; offset -= 1) {
    const bounds = periodBoundsAt(periodStartDay, now, offset);
    if (bounds.start < since) break;
    closedPeriods.push(bounds);
  }
  // Del más viejo al más nuevo — el clamp de cada paso depende del carry
  // acumulado hasta ese punto, así que el orden cronológico es obligatorio.
  closedPeriods.reverse();

  let carry = 0n;
  let excludedCount = 0;
  for (const { start, end } of closedPeriods) {
    const progress = computeBudgetProgress(budget, allTransactionsInRange, start, end, categories);
    excludedCount += progress.excludedCount;
    const raw = budget.amountLimit + carry - progress.spent;
    carry = clampCarry(raw, budget.rolloverSurplus, budget.rolloverDeficit);
  }

  return { carry, excludedCount };
}

export interface BudgetProgressWithRollover {
  spent: bigint;
  /** `spent / (amountLimit + carry)` — puede superar 1. */
  progress: number;
  /** `needs_fx` del período en curso MÁS el de los períodos que entraron en el arrastre. */
  excludedCount: number;
  /** Lo que se arrastró del período anterior — positivo (sobrante) o negativo (exceso). 0 si el presupuesto no tiene rollover activo. */
  carry: bigint;
}

/**
 * Progreso del período en curso con el límite efectivo (`amountLimit + carry`)
 * cuando el presupuesto tiene rollover activo. Con los dos flags en
 * `false` es idéntico a `computeBudgetProgress()` con `carry = 0n` — los
 * callers pueden usar esta función siempre, activado o no, sin ramificar.
 */
export function computeBudgetProgressWithRollover(
  budget: BudgetRolloverInput,
  allTransactionsInRange: readonly BudgetTransactionInput[],
  periodStartDay: number,
  now: Date,
  categories: readonly Pick<CategoryRow, "id" | "parentId">[]
): BudgetProgressWithRollover {
  const { start, end } = periodBoundsAt(periodStartDay, now, 0);
  const { carry, excludedCount: rolloverExcluded } = computeBudgetRollover(budget, allTransactionsInRange, periodStartDay, now, categories);
  const effectiveLimit = budget.amountLimit + carry;
  const current = computeBudgetProgress({ ...budget, amountLimit: effectiveLimit }, allTransactionsInRange, start, end, categories);
  return {
    spent: current.spent,
    progress: current.progress,
    excludedCount: current.excludedCount + rolloverExcluded,
    carry,
  };
}

const WARNING_THRESHOLD = 0.8;

/** Espejo de `identifyBudgetAlerts()` (`budget-progress.ts`) pero con el límite efectivo del rollover. */
export function identifyBudgetAlertsWithRollover<TBudget extends BudgetRolloverInput>(
  budgets: readonly TBudget[],
  transactions: readonly BudgetTransactionInput[],
  periodStartDay: number,
  now: Date,
  categories: readonly Pick<CategoryRow, "id" | "parentId">[]
): BudgetAlert<TBudget>[] {
  const alerts: BudgetAlert<TBudget>[] = [];
  for (const budget of budgets) {
    const { progress } = computeBudgetProgressWithRollover(budget, transactions, periodStartDay, now, categories);
    let level: BudgetAlertLevel | null = null;
    if (progress >= 1) level = "exceeded";
    else if (progress >= WARNING_THRESHOLD) level = "warning";
    if (level) alerts.push({ budget, level, progress });
  }
  return alerts;
}
