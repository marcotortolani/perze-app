import { comparePeriods, expenseByCategory, summarizePeriod, type PeriodTransactionInput } from "./period-summary";
import { investingActivity } from "./period-balances";

/**
 * Arma el resumen del período que cerró, a partir de filas crudas
 * (`docs/resumen-mensual-por-mail.md`).
 *
 * **Es la única pieza que la Edge Function no puede tener.** Esa función
 * corre en Deno y no importa de `src/`, así que si el cálculo viviera allá
 * habría dos versiones de la regla de signo por `kind`, de la exclusión de
 * `needs_fx` y del recorte del período. Ya pasó con `daily-fx-sync`, cuyo
 * set de monedas quedó en 14 mientras el del cliente tenía 30 — y nadie se
 * enteró. Acá el modo de falla sería peor: un mail cuyos números no
 * coinciden con la app, que no se reporta como bug porque se lee como que
 * la app miente.
 *
 * Por eso la Edge Function solo lee filas y las postea; esta función las
 * convierte en el resumen, reusando los mismos agregados que las pantallas.
 */

export interface MonthlySummaryTransactionInput extends PeriodTransactionInput {
  categoryId: string | null;
  /**
   * Nombre de la categoría **si ese miembro puede verla**. `null` cuando la
   * categoría es privada de otro: el movimiento sigue contando en los
   * totales (es household, se ve en la app) pero su plata cae en "sin
   * categoría" en vez de revelar el nombre por mail.
   */
  categoryName: string | null;
}

export interface MonthlySummaryAccountInput {
  name: string;
  currencyCode: string;
  /** Saldo al inicio del período, en la moneda de ESA cuenta. */
  opening: bigint;
  /** Saldo al cierre, misma moneda. */
  closing: bigint;
}

export interface BuildMonthlySummaryInput {
  from: Date;
  /** Exclusivo: el inicio del período siguiente. */
  to: Date;
  transactions: readonly MonthlySummaryTransactionInput[];
  /** Inicio del período anterior. Su fin es `from`. */
  previousFrom: Date;
  /** Del período anterior, solo para la comparación de gasto. */
  previousTransactions: readonly PeriodTransactionInput[];
  accounts: readonly MonthlySummaryAccountInput[];
  /** Cuántas categorías lista el mail. 5 por defecto, como la paleta de datos. */
  topCategoryLimit?: number;
}

export interface MonthlySummaryCategoryLine {
  label: string;
  total: bigint;
}

export interface MonthlySummary {
  /**
   * Los tres números de arriba salen del par de CONSUMO, no del de
   * liquidez (`cash-flow.ts`): comprar un instrumento no es un egreso del
   * mes, y meterlo adentro haría que "gastaste 40% más" dependiera de si
   * ese mes se movió plata al broker. Lo que sí movió liquidez y no es
   * consumo aparece en su propia sección, `investing`.
   */
  income: bigint;
  expenses: bigint;
  /** `income - expenses`. */
  net: bigint;
  /** Variación del gasto contra el período anterior. `null` = no hay con qué comparar. */
  expenseChangePct: number | null;
  accounts: MonthlySummaryAccountInput[];
  topCategories: MonthlySummaryCategoryLine[];
  /** `null` si no hubo un solo movimiento de inversión — la sección no se dibuja. */
  investing: { invested: bigint; divested: bigint } | null;
  /** Movimientos sin cotización dentro del período, excluidos de todos los totales. */
  excludedCount: number;
  /** `false` = período sin movimientos. Un mail de resumen vacío no se manda. */
  hasActivity: boolean;
}

const DEFAULT_TOP_CATEGORIES = 5;

export interface BiggestPeriod {
  /** Inicio del período con más gasto de consumo. */
  start: Date;
  total: bigint;
}

/**
 * De todos los períodos que abarca el resumen anual, el de mayor gasto.
 *
 * `cuts` son los inicios de cada período más el fin del último —doce
 * períodos son trece cortes— y salen de `household_period_cuts()` en SQL,
 * que es donde vive la regla del día de cierre del hogar. Acá solo se
 * agrupa: cada bucket pasa por `summarizePeriod`, así que la exclusión de
 * `needs_fx` y el signo por `kind` siguen siendo los mismos de siempre.
 *
 * Devuelve `null` si no hubo un solo gasto en todo el rango: un "tu mes de
 * mayor gasto" con cero adentro no es un dato, es una fila vacía.
 */
export function biggestPeriodByExpense(transactions: readonly PeriodTransactionInput[], cuts: readonly Date[]): BiggestPeriod | null {
  let biggest: BiggestPeriod | null = null;
  for (let i = 0; i < cuts.length - 1; i += 1) {
    const start = cuts[i]!;
    const { expenseTotal } = summarizePeriod(transactions, start, cuts[i + 1]!);
    if (expenseTotal > 0n && (biggest === null || expenseTotal > biggest.total)) biggest = { start, total: expenseTotal };
  }
  return biggest;
}

export function buildMonthlySummary(input: BuildMonthlySummaryInput): MonthlySummary {
  const { from, to, transactions, previousFrom, previousTransactions, accounts } = input;
  const limit = input.topCategoryLimit ?? DEFAULT_TOP_CATEGORIES;

  const current = summarizePeriod(transactions, from, to);
  // El período anterior tiene sus propios límites: `[previousFrom, from)`.
  // Resumirlo con los del período en curso lo dejaría en cero y la
  // comparación diría "no hay con qué comparar" para todo el mundo.
  const previous = summarizePeriod(previousTransactions, previousFrom, from);
  const comparison = comparePeriods(current, previous);

  // Una categoría que este miembro no puede ver cuenta como "sin
  // categoría": su plata no desaparece del total, pero el nombre no viaja.
  const categorized = transactions.map((tx) => ({ ...tx, categoryId: tx.categoryName ? tx.categoryId : null }));
  const byCategory = expenseByCategory(categorized, from, to);
  const names = new Map<string, string>();
  for (const tx of transactions) {
    if (tx.categoryId && tx.categoryName) names.set(tx.categoryId, tx.categoryName);
  }

  const topCategories = byCategory.categories
    .slice(0, limit)
    .map((entry) => ({ label: names.get(entry.categoryId) ?? "", total: entry.total }))
    .filter((line) => line.label !== "");

  const investing = investingActivity(transactions, from, to);

  return {
    income: current.incomeTotal,
    expenses: current.expenseTotal,
    net: current.incomeTotal - current.expenseTotal,
    expenseChangePct: comparison.expensePct,
    accounts: accounts.map((account) => ({ ...account })),
    topCategories,
    investing: investing.count > 0 ? { invested: investing.invested, divested: investing.divested } : null,
    excludedCount: current.excludedCount,
    hasActivity: transactions.length > 0,
  };
}
