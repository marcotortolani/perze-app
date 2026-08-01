/** H7 — ajuste por inflación: nominal vs. "en pesos de hoy", usando `price_index` (IPC u otro índice de precios). */

export interface PriceIndexPoint {
  period: string; // "YYYY-MM"
  indexValue: number;
}

/** Reexpresa un monto nominal de `period` en pesos del período más reciente del índice. `null` si falta el índice de cualquiera de los dos períodos. */
export function adjustForInflation(nominalAmount: bigint, period: string, indexPoints: readonly PriceIndexPoint[]): bigint | null {
  const byPeriod = new Map(indexPoints.map((p) => [p.period, p.indexValue]));
  const periodIndex = byPeriod.get(period);
  if (periodIndex === undefined) return null;

  const latest = [...indexPoints].sort((a, b) => b.period.localeCompare(a.period))[0];
  if (!latest) return null;

  const factor = latest.indexValue / periodIndex;
  return BigInt(Math.round(Number(nominalAmount) * factor));
}

/** % de inflación acumulada entre dos períodos, `null` si falta alguno. */
export function inflationBetween(fromPeriod: string, toPeriod: string, indexPoints: readonly PriceIndexPoint[]): number | null {
  const byPeriod = new Map(indexPoints.map((p) => [p.period, p.indexValue]));
  const from = byPeriod.get(fromPeriod);
  const to = byPeriod.get(toPeriod);
  if (from === undefined || to === undefined || from === 0) return null;
  return ((to - from) / from) * 100;
}
