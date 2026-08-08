import { fromMajorUnitsUnsafe } from "@/lib/money/money";

export interface PriceHistoryPoint {
  asOf: string; // ISO YYYY-MM-DD
  close: number;
}

/** `history` ordenada ascendente por `asOf`. Última conocida ≤ `date` — mismo criterio de "carry-forward" que el resto de la app usa para FX (`inherited`): un fin de semana o feriado sin snapshot nuevo no es un hueco, es el mismo precio de ayer. */
export function nearestPriceOnOrBefore(history: readonly PriceHistoryPoint[], date: string): number | null {
  let result: number | null = null;
  for (const point of history) {
    if (point.asOf > date) break;
    result = point.close;
  }
  return result;
}

export interface TrendPosition {
  instrumentId: string;
  quantity: number;
  currencyCode: string;
}

/**
 * Valor total de las posiciones en `date`, con el precio de ese día
 * (`priceHistoryByInstrument`) y la cotización a moneda base — nunca la de
 * `date`, la de HOY (ver el comentario de `computeInvestmentsTrend`, es
 * una simplificación documentada, no un dato inventado). Una posición sin
 * precio conocido a esa fecha, o sin cotización a la moneda base, se
 * excluye del total — nunca se cuenta como 0.
 */
export function computeDayValue(
  positions: readonly TrendPosition[],
  priceHistoryByInstrument: ReadonlyMap<string, readonly PriceHistoryPoint[]>,
  date: string,
  baseCurrency: string,
  convertToBase: (amount: bigint, currency: string) => bigint | null
): { value: bigint; excludedCount: number } {
  let value = 0n;
  let excludedCount = 0;

  for (const position of positions) {
    const history = priceHistoryByInstrument.get(position.instrumentId);
    const close = history ? nearestPriceOnOrBefore(history, date) : null;
    if (close === null) {
      excludedCount += 1;
      continue;
    }
    // Mismo criterio que `computeInvestmentsValue`: cantidad × precio, en
    // unidades mínimas de la moneda del instrumento — nunca `number`/`float`
    // para la plata, solo para `quantity` (cantidad, no plata).
    const marketValue = fromMajorUnitsUnsafe(position.quantity * close, position.currencyCode);
    if (position.currencyCode === baseCurrency) {
      value += marketValue;
      continue;
    }
    const converted = convertToBase(marketValue, position.currencyCode);
    if (converted === null) {
      excludedCount += 1;
      continue;
    }
    value += converted;
  }

  return { value, excludedCount };
}
