/**
 * Motor puro de ocurrencias de una regla recurrente. Espejado en SQL por
 * `public.recurring_occurrences_between` (`supabase/migrations/20260805000000_recurring_v3.sql`)
 * — los vectores de `__fixtures__/occurrence-vectors.json` son la fuente
 * única de verdad para que las dos implementaciones no diverjan (ver
 * `occurrences.test.ts` y `supabase/tests/database/24_recurring_occurrences.sql`).
 *
 * Toda la aritmética de fecha es sobre año/mes/día enteros vía `Date.UTC`,
 * nunca sobre el constructor local de `Date` — así el resultado no depende
 * de la zona horaria de quien ejecuta el código.
 */

export type RecurringFrequency = "weekly" | "biweekly" | "monthly" | "yearly";

export interface OccurrenceRule {
  frequency: RecurringFrequency;
  /** YYYY-MM-DD — fase del timeline: qué martes, qué quincena, qué mes/día. */
  anchorDate: string;
  /** Solo mensual/anual — el día de mes con clamp a 28/29/30/31. `null` en semanal/quincenal. */
  dayOfMonth: number | null;
  /** YYYY-MM-DD o `null` — techo de la regla. */
  endDate: string | null;
}

function ymd(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y!, m!, d!];
}

function toUtcDays(iso: string): number {
  const [y, m, d] = ymd(iso);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

function fromUtcDays(days: number): string {
  const dt = new Date(days * 86_400_000);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Último día real de un mes (1-indexado) — mismo criterio que `clamped_date` en SQL. */
function lastDayOfMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function clampedDate(year: number, month1: number, day: number): string {
  const d = Math.min(day, lastDayOfMonth(year, month1));
  return `${year}-${String(month1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Ocurrencias mensuales/anuales entre `[from, to]` (ambos incluidos), ancladas al mes/año de `anchorDate`. */
function monthlyOrYearlyOccurrences(rule: OccurrenceRule, from: string, to: string): string[] {
  const day = rule.dayOfMonth;
  if (day === null) return [];
  const [ay, am] = ymd(rule.anchorDate);
  const [fy, fm] = ymd(from);
  const step = rule.frequency === "yearly" ? 12 : 1;

  // `k` en múltiplos de `step`, arrancando un paso antes del mes más
  // cercano a `from` — margen suficiente para que el clamp de día nunca
  // haga perder una ocurrencia real, sin iterar mes a mes desde el ancla
  // cuando `from` está años después (el caso normal: ancla vieja, `from`
  // es el piso del catch-up cerca de hoy).
  const rawOffset = (fy - ay) * 12 + (fm - am);
  const kStart = (Math.floor(rawOffset / step) - 1) * step;

  const out: string[] = [];
  for (let k = kStart; ; k += step) {
    const totalMonths = am - 1 + k;
    const yOffset = Math.floor(totalMonths / 12);
    const y = ay + yOffset;
    const m = totalMonths - yOffset * 12 + 1;
    const iso = clampedDate(y, m, day);
    if (iso > to) break;
    if (iso >= from) out.push(iso);
  }
  return out;
}

/** Ocurrencias semanales/quincenales entre `[from, to]`, ancladas a `anchorDate`. */
function weeklyOrBiweeklyOccurrences(rule: OccurrenceRule, from: string, to: string): string[] {
  const stepDays = rule.frequency === "biweekly" ? 14 : 7;
  const anchor = toUtcDays(rule.anchorDate);
  const fromDays = Math.max(toUtcDays(from), anchor);
  const toDays = toUtcDays(to);
  if (toDays < anchor) return [];

  const offset = ((fromDays - anchor) % stepDays + stepDays) % stepDays;
  const firstDays = fromDays + (offset === 0 ? 0 : stepDays - offset);

  const out: string[] = [];
  for (let d = firstDays; d <= toDays; d += stepDays) out.push(fromUtcDays(d));
  return out;
}

/** Todas las fechas (YYYY-MM-DD) en que la regla ocurre entre `from` y `to`, ambos inclusive. `from > to` da `[]`. */
export function occurrencesBetween(rule: OccurrenceRule, from: string, to: string): string[] {
  if (from > to) return [];
  const cappedTo = rule.endDate && rule.endDate < to ? rule.endDate : to;
  if (from > cappedTo) return [];
  const raw = rule.frequency === "weekly" || rule.frequency === "biweekly" ? weeklyOrBiweeklyOccurrences(rule, from, cappedTo) : monthlyOrYearlyOccurrences(rule, from, cappedTo);
  return raw.filter((d) => d >= rule.anchorDate);
}

/** Primera ocurrencia estrictamente posterior a `afterIso` (YYYY-MM-DD), o `null` si la regla ya terminó. */
export function nextOccurrenceAfter(rule: OccurrenceRule, afterIso: string): string | null {
  const from = fromUtcDays(toUtcDays(afterIso) + 1);
  const to = rule.endDate ?? fromUtcDays(toUtcDays(from) + 366 * 2);
  const found = occurrencesBetween(rule, from, to);
  return found[0] ?? null;
}

/** Mediodía UTC de una fecha de ocurrencia — inmune a DST y al mismo día calendario en todo huso horario UTC-11..UTC+11. */
export function occurredAtFor(occurrenceDate: string): string {
  return `${occurrenceDate}T12:00:00.000Z`;
}

/** Ocurrencias por año de cada frecuencia, para anualizar un monto (redondeo bancario simple: entero hacia el más cercano). */
export function occurrencesPerYear(frequency: RecurringFrequency): number {
  switch (frequency) {
    case "weekly":
      return 52;
    case "biweekly":
      return 26;
    case "monthly":
      return 12;
    case "yearly":
      return 1;
  }
}

/** Equivalente mensual de un monto por frecuencia — para sumar "comprometido por mes" entre reglas de distinta frecuencia. */
export function monthlyEquivalent(amount: bigint, frequency: RecurringFrequency): bigint {
  const perYear = BigInt(occurrencesPerYear(frequency));
  return (amount * perYear) / 12n;
}

/**
 * "Cargar ahora" (`recurring/[id]/page.tsx`) solo se ofrece para lo
 * vencido o lo que vence HOY — nunca para un período que todavía no
 * llegó. Antes no había este tope: con auto-registro OFF cualquier
 * período sin saldar dentro del horizonte de 2 años habilitaba el botón,
 * así que tocarlo varias veces seguidas encadenaba cargas de meses
 * futuros uno atrás de otro, sin que nada en pantalla avisara que ya se
 * habían generado. Precargar con anticipación deja de estar permitido a
 * cambio de que el botón no pueda dispararse por accidente más allá de lo
 * que hoy corresponde pagar — ponerse al día con varios períodos
 * atrasados sigue andando igual, porque esos SÍ son `<= today`.
 */
export function isChargeDue(autoPost: boolean, nextChargeableDate: string | null, today: string): boolean {
  return !autoPost && nextChargeableDate !== null && nextChargeableDate <= today;
}
