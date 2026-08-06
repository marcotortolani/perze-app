export type PriceHistoryRange = "week" | "month" | "6m" | "year";

export const PRICE_HISTORY_RANGES: PriceHistoryRange[] = ["week", "month", "6m", "year"];

const RANGE_DAYS: Record<PriceHistoryRange, number> = {
  week: 7,
  month: 30,
  "6m": 182,
  year: 365,
};

/**
 * Un gráfico con dos puntos enseña una tendencia que no existe (CLAUDE.md
 * § "Mínimos de historial") — acá se aplica el mismo criterio a la serie de
 * precios: hacen falta al menos 3 cierres reales para dibujar una línea.
 */
export const MIN_HISTORY_POINTS = 3;

/**
 * Fecha ISO (YYYY-MM-DD) desde la que arranca el rango, anclada a mediodía
 * UTC (D10) — evita que restar días corra la fecha un día para atrás en un
 * huso negativo apenas se la vuelve a parsear.
 */
export function sinceIsoForRange(range: PriceHistoryRange, todayIso: string): string {
  const [y, m, d] = todayIso.split("-").map(Number);
  const anchor = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12));
  anchor.setUTCDate(anchor.getUTCDate() - RANGE_DAYS[range]);
  return anchor.toISOString().slice(0, 10);
}
