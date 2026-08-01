/**
 * D10 — la fecha "de hoy" del usuario, no la de UTC. `new Date().toISOString()
 * .slice(0, 10)` (el bug original, repetido en 14 sitios) toma el día en UTC:
 * para alguien en UTC−3, todo lo cargado entre las 21:00 y las 00:00 local
 * queda fechado "mañana" — cae en el período equivocado en los cortes de
 * mes y el snapshot de FX se pide para una fecha sin cotización.
 *
 * `Intl.DateTimeFormat` con la zona horaria real del dispositivo (o una
 * explícita, para tests) da el día calendario correcto sin arrastrar una
 * dependencia de fechas nueva.
 */
export function todayIso(timeZone?: string): string {
  const tz = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value])) as Record<string, string>;
  return `${byType.year}-${byType.month}-${byType.day}`;
}
