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

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Espejo de `household_period_start()` (`supabase/migrations/20260810190000_monthly_summary_schedule.sql`):
 * mismo clamp al último día del mes. La UI hoy solo ofrece `período_start_day` 1-28
 * (`CLOSE_DAYS` en `/more/settings`), así que "31 en febrero" no se puede producir todavía —
 * el clamp está acá para que el día que esa lista se amplíe, esto no empiece a devolver
 * fechas del mes siguiente en silencio, y para que cliente y servidor nunca diverjan en
 * qué período es cuál (necesario para el cierre de período).
 */
function periodStart(date: Date, periodStartDay: number): Date {
  const clampedDay = (year: number, month: number) => Math.min(Math.max(periodStartDay, 1), lastDayOfMonth(year, month));
  const start = new Date(date.getFullYear(), date.getMonth(), clampedDay(date.getFullYear(), date.getMonth()));
  if (date.getDate() < start.getDate()) {
    const prevMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    start.setFullYear(prevMonth.getFullYear(), prevMonth.getMonth(), clampedDay(prevMonth.getFullYear(), prevMonth.getMonth()));
  }
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

/**
 * [inicio, fin) del período que empieza `offset` períodos del household
 * antes (o después, con `offset` positivo) del que contiene `now`.
 * `offset = 0` es el período EN CURSO (`currentPeriodBounds`), `offset = -1`
 * el ÚLTIMO CERRADO (`previousClosedPeriodBounds`), `offset = -2` el
 * anterior a ese, etc. — generaliza las dos funciones de abajo para el
 * rollover de presupuesto, que necesita iterar N períodos cerrados hacia
 * atrás desde que se activó, no solo el inmediato anterior.
 */
export function periodBoundsAt(periodStartDay: number, now: Date, offset: number): { start: Date; end: Date } {
  const currentStart = periodStart(now, periodStartDay);
  const start = new Date(currentStart.getFullYear(), currentStart.getMonth() + offset, periodStartDay);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, periodStartDay);
  return { start, end };
}

/** [inicio, fin) del ÚLTIMO período cerrado — el mes en curso miente para tasa de ahorro/cashflow. */
export function previousClosedPeriodBounds(periodStartDay: number, now: Date): { start: Date; end: Date } {
  return periodBoundsAt(periodStartDay, now, -1);
}

/** [inicio, fin) del período EN CURSO — para presupuestos, que se leen mientras el mes todavía corre. */
export function currentPeriodBounds(periodStartDay: number, now: Date): { start: Date; end: Date } {
  return periodBoundsAt(periodStartDay, now, 0);
}
