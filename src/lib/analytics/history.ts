/**
 * Mínimos de historial del Bloque H (CLAUDE.md § "Mínimos de historial"):
 * cada análisis declara el suyo y, hasta alcanzarlo, la pantalla muestra
 * cuánto falta en vez del gráfico — nunca un gráfico pobre con dos puntos.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Días transcurridos desde el primer movimiento — `null` si no hay ninguno todavía. */
export function daysOfHistory(firstTransactionIso: string | undefined, now: Date): number {
  if (!firstTransactionIso) return 0;
  const first = new Date(firstTransactionIso);
  return Math.max(0, Math.floor((now.getTime() - first.getTime()) / DAY_MS));
}

/** Meses calendario completos transcurridos desde el primer movimiento. */
export function monthsOfHistory(firstTransactionIso: string | undefined, now: Date): number {
  if (!firstTransactionIso) return 0;
  const first = new Date(firstTransactionIso);
  const months = (now.getFullYear() - first.getFullYear()) * 12 + (now.getMonth() - first.getMonth());
  return Math.max(0, now.getDate() >= first.getDate() ? months : months - 1);
}

function periodStart(date: Date, periodStartDay: number): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), periodStartDay);
  if (date.getDate() < periodStartDay) start.setMonth(start.getMonth() - 1);
  return start;
}

/**
 * Cuántos períodos del household (día de cierre configurable) terminaron
 * por completo desde el primer movimiento — 0 si el usuario todavía está
 * en su primer período.
 */
export function closedPeriodsCount(firstTransactionIso: string | undefined, periodStartDay: number, now: Date): number {
  if (!firstTransactionIso) return 0;
  const first = new Date(firstTransactionIso);
  const firstPeriodStart = periodStart(first, periodStartDay);
  const currentPeriodStart = periodStart(now, periodStartDay);
  const months = (currentPeriodStart.getFullYear() - firstPeriodStart.getFullYear()) * 12 + (currentPeriodStart.getMonth() - firstPeriodStart.getMonth());
  return Math.max(0, months);
}

/** Días que faltan para que cierre el período en curso — para el copy "faltan N días". */
export function daysUntilPeriodCloses(periodStartDay: number, now: Date): number {
  const start = periodStart(now, periodStartDay);
  const nextClose = new Date(start.getFullYear(), start.getMonth() + 1, periodStartDay);
  return Math.max(0, Math.ceil((nextClose.getTime() - now.getTime()) / DAY_MS));
}

/** [inicio, fin) del ÚLTIMO período cerrado — el mes en curso miente para tasa de ahorro/cashflow. */
export function previousClosedPeriodBounds(periodStartDay: number, now: Date): { start: Date; end: Date } {
  const end = periodStart(now, periodStartDay);
  const start = new Date(end.getFullYear(), end.getMonth() - 1, periodStartDay);
  return { start, end };
}

/** [inicio, fin) del período EN CURSO — para presupuestos, que se leen mientras el mes todavía corre. */
export function currentPeriodBounds(periodStartDay: number, now: Date): { start: Date; end: Date } {
  const start = periodStart(now, periodStartDay);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, periodStartDay);
  return { start, end };
}
