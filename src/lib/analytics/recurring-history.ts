import { occurrencesPerYear, type RecurringFrequency } from "@/lib/recurring/occurrences";

export interface AmountPoint {
  date: string;
  amount: bigint;
}

export interface PriceIncrease {
  from: bigint;
  to: bigint;
  at: string;
  pct: number;
  annualImpact: bigint;
}

/** Mínimo de puntos antes de dibujar "monto mes a mes" — un gráfico de 1-2 puntos enseña una tendencia que no existe. */
export const RECURRING_HISTORY_MIN_POINTS = 3;

const INCREASE_THRESHOLD_PCT = 10;

/**
 * Serie de montos de una regla, a partir de sus propias transacciones
 * generadas (nunca una columna `amount_history`): la decisión de que
 * editar el monto de la regla afecta solo el futuro ya convierte a esos
 * movimientos en el historial real, y si el usuario corrige uno puntual el
 * gráfico tiene que reflejar eso, no lo que la regla "debería" haber
 * cobrado. Toda la serie está en la misma moneda (la de la regla) — no
 * aplica exclusión `needs_fx` acá, esa vive en los agregados que suman
 * entre monedas.
 */
export function amountSeries(transactions: readonly { occurredAt: string; amount: bigint; deletedAt: string | null }[]): AmountPoint[] {
  return transactions
    .filter((t) => t.deletedAt === null)
    .map((t) => ({ date: t.occurredAt.slice(0, 10), amount: t.amount }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Sugerencia de próximo monto para una regla de monto variable (agua, luz,
 * gas, cualquier servicio que no cobra siempre lo mismo): promedio de los
 * últimos 3 cargos reales de la serie. Existe para que "Cargar ahora" no
 * fuerce a tipear el monto desde cero en cada ciclo — el promedio reciente
 * suele estar más cerca del próximo cargo que el `expectedAmount` de la
 * regla, que solo se actualiza cuando el usuario confirma un monto
 * distinto. `null` con el mismo mínimo que `detectPriceIncrease`
 * (`RECURRING_HISTORY_MIN_POINTS`): un promedio de 1-2 cargos no es una
 * sugerencia, es ruido.
 */
export function suggestedNextAmount(series: readonly AmountPoint[]): bigint | null {
  if (series.length < RECURRING_HISTORY_MIN_POINTS) return null;
  const lastThree = series.slice(-3);
  const sum = lastThree.reduce((s, p) => s + p.amount, 0n);
  return sum / BigInt(lastThree.length);
}

/** Aumento entre el último monto y el anterior monto DISTINTO — nunca entre dos puntos iguales. `null` si no hay suficiente historial o el cambio no llega al umbral. */
export function detectPriceIncrease(series: readonly AmountPoint[], frequency: RecurringFrequency): PriceIncrease | null {
  if (series.length < RECURRING_HISTORY_MIN_POINTS) return null;
  const last = series[series.length - 1]!;
  let previous: AmountPoint | undefined;
  for (let i = series.length - 2; i >= 0; i--) {
    if (series[i]!.amount !== last.amount) {
      previous = series[i];
      break;
    }
  }
  if (!previous || previous.amount <= 0n || last.amount <= previous.amount) return null;

  const pct = (Number(last.amount - previous.amount) / Number(previous.amount)) * 100;
  if (pct < INCREASE_THRESHOLD_PCT) return null;

  const perYear = BigInt(occurrencesPerYear(frequency));
  return {
    from: previous.amount,
    to: last.amount,
    at: last.date,
    pct: Math.round(pct),
    annualImpact: (last.amount - previous.amount) * perYear,
  };
}
