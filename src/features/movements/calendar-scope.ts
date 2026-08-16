import type { TransactionRow as TransactionRecord } from "@/lib/db/schema";
import { classifyConsumption } from "@/lib/analytics/cash-flow";
import type { DatePreset } from "./MovementsFiltersSheet";

/**
 * El alcance de fecha de la lista de movimientos, y la grilla del calendario
 * que lo maneja (D1/D5).
 *
 * **Por qué todo esto vive en un módulo propio y no adentro de la pantalla.**
 * El calendario no tiene estado propio de mes ni de día: los deriva de los
 * search params `from`/`to`, que son los mismos que ya usaba la lista para el
 * rango de fecha. Una sola fuente de verdad significa que el mes visible no
 * puede desincronizarse de lo que la lista está mostrando — pero también que
 * las dos puntas (armar el rango, leerlo de vuelta) tienen que hablar
 * exactamente el mismo idioma. Acá están las dos, juntas y testeadas.
 *
 * **La regla que no se puede romper: medianoche LOCAL, serializada a UTC.**
 * `occurredAt` es un `timestamptz` en UTC, y el filtro de la lista compara
 * strings ISO completos. `periodStartFor` viene armando sus límites con
 * `new Date(y, m, d).toISOString()`, o sea el instante UTC que corresponde a
 * la medianoche del huso del dispositivo. Si el calendario armara `${iso}T00:00:00Z`
 * en vez de eso, los límites se correrían el offset del huso —tres horas en
 * Uruguay o Argentina— y los movimientos de la primera y la última franja del
 * día caerían en el día equivocado. Es exactamente la clase de bug de
 * `CLAUDE.md` § huso horario, y por eso `localMidnightIso` es la ÚNICA forma
 * de construir un límite acá adentro: `periodStartFor` también la usa, así que
 * las dos recetas no pueden divergir sin que falle el test que las compara.
 */

/**
 * Lunes. El diseño (`docs/design/bloque-d-movimientos.html:443-449`) arranca la
 * semana en lunes, que además es la convención de es/pt, y el código venía
 * arrancando en domingo.
 */
export const WEEK_STARTS_ON = 1;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatMonth(year: number, monthIndex: number): string {
  return `${year}-${pad(monthIndex + 1)}`;
}

function formatDay(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function splitMonth(month: string): [number, number] {
  const [y, m] = month.split("-").map(Number);
  return [y!, m! - 1];
}

function splitDay(day: string): [number, number, number] {
  const [y, m, d] = day.split("-").map(Number);
  return [y!, m! - 1, d!];
}

/**
 * Medianoche LOCAL del día indicado, serializada como instante UTC. La única
 * forma legítima de construir un límite de rango en esta pantalla — ver la
 * nota de arriba. Acepta índices fuera de rango (`monthIndex + 1`, `day + 1`):
 * `Date` los normaliza sola, así que el último día del mes y diciembre no
 * necesitan un caso especial.
 */
export function localMidnightIso(year: number, monthIndex: number, day: number): string {
  return new Date(year, monthIndex, day).toISOString();
}

export interface DateRange {
  from: string;
  to: string;
}

/** Rango del mes completo. `month` es `"YYYY-MM"`. */
export function monthRange(month: string): DateRange {
  const [y, m] = splitMonth(month);
  return { from: localMidnightIso(y, m, 1), to: localMidnightIso(y, m + 1, 1) };
}

/** Rango de un día. `day` es `"YYYY-MM-DD"`. `to` es exclusivo, como el filtro de la lista. */
export function dayRange(day: string): DateRange {
  const [y, m, d] = splitDay(day);
  return { from: localMidnightIso(y, m, d), to: localMidnightIso(y, m, d + 1) };
}

export interface CalendarScope {
  /** `"YYYY-MM"` — el mes que dibuja la grilla. */
  month: string;
  /** `"YYYY-MM-DD"` si el rango es exactamente un día; `null` si es el mes entero u otra cosa. */
  day: string | null;
}

/**
 * Lee el alcance de vuelta desde los params. Es la inversa de `monthRange` /
 * `dayRange`, y tolera rangos que no armó el calendario: al home, por ejemplo,
 * linkea con el rango del período del household, que no es ni un mes calendario
 * ni un día. En ese caso el mes visible es el del arranque del rango y no hay
 * día elegido, que es lo razonable de mostrar.
 */
export function scopeFromParams(from: string | null | undefined, to: string | null | undefined, now: Date): CalendarScope {
  const start = from ? new Date(from) : now;
  const anchor = Number.isNaN(start.getTime()) ? now : start;
  const month = formatMonth(anchor.getFullYear(), anchor.getMonth());
  if (!from || !to) return { month, day: null };
  const candidate = formatDay(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const range = dayRange(candidate);
  return { month, day: from === range.from && to === range.to ? candidate : null };
}

/**
 * Inversa de `monthRange`: `null` salvo que `from`/`to` sean EXACTAMENTE el
 * rango de un mes calendario completo — un día suelto (`dayRange`) o un
 * preset arbitrario (el período del household que linkea el home) no
 * cuentan. Vive separada de `scopeFromParams` porque las dos preguntan cosas
 * distintas: esa devuelve "qué día, si hay uno" (para el calendario), esta
 * devuelve "qué mes, si el rango ES un mes" (para el panel de historial y su
 * chip de período aplicado).
 */
export function monthFromParams(from: string | null | undefined, to: string | null | undefined): string | null {
  if (!from || !to) return null;
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return null;
  const month = formatMonth(start.getFullYear(), start.getMonth());
  const range = monthRange(month);
  return from === range.from && to === range.to ? month : null;
}

/** Corre el mes `delta` meses. `Date` cruza el año sola. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = splitMonth(month);
  const d = new Date(y, m + delta, 1);
  return formatMonth(d.getFullYear(), d.getMonth());
}

/** El mes al que pertenece un día. */
export function monthOfDay(day: string): string {
  return day.slice(0, 7);
}

/**
 * El día LOCAL al que pertenece un `occurredAt`.
 *
 * No es `occurredAt.slice(0, 10)`: ese slice devuelve el día en UTC, y en
 * cualquier huso negativo un movimiento de la noche cae en el día siguiente.
 * Mientras el calendario tenía su propia lista el desfasaje era invisible
 * (agrupaba y filtraba con el mismo criterio equivocado), pero ahora el
 * heatmap cuenta por día y la lista filtra por rango de medianoche local: si
 * los dos no usan la misma definición de "día", tocar una celda muestra un
 * conjunto distinto del que la celda contó.
 */
export function dayKeyOf(occurredAt: string): string {
  const d = new Date(occurredAt);
  return formatDay(d.getFullYear(), d.getMonth(), d.getDate());
}

/** `true` si el día es posterior a hoy. Los dos argumentos son `"YYYY-MM-DD"`, así que alcanza con comparar strings. */
export function isFutureDay(day: string, today: string): boolean {
  return day > today;
}

/**
 * Las celdas del mes, con `null` de relleno adelante hasta el primer día.
 * Sin relleno al final: la grilla es de 7 columnas y la última fila queda
 * corta, que es lo que dibuja el diseño.
 */
export function monthGrid(month: string, options?: { weekStartsOn?: number }): (string | null)[] {
  const weekStartsOn = options?.weekStartsOn ?? WEEK_STARTS_ON;
  const [y, m] = splitMonth(month);
  const leading = (new Date(y, m, 1).getDay() - weekStartsOn + 7) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(formatDay(y, m, d));
  return cells;
}

/**
 * Siete fechas consecutivas que arrancan en el primer día de la semana, para
 * sacar las etiquetas de los días con `formatWeekdayNarrow`. Las etiquetas
 * siguen saliendo del locale; esto solo decide en qué día ancla la semana.
 */
export function weekdayAnchors(reference: Date, weekStartsOn: number = WEEK_STARTS_ON): Date[] {
  const back = (reference.getDay() - weekStartsOn + 7) % 7;
  const start = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() - back);
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/**
 * Mediodía UTC — a medianoche cualquier huso negativo formatea el día anterior
 * (`CLAUDE.md` § huso horario). Para fechas-sin-hora sintetizadas en el cliente
 * que solo se van a FORMATEAR; para comparar contra `occurredAt` va
 * `localMidnightIso`.
 */
export function noonUtc(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

/**
 * Gasto por día, que es lo que el heatmap codifica en color.
 *
 * Excluye los movimientos sin cotización (`amountBase === null`) en vez de
 * contarlos como cero: un gasto sin rate no tiene monto en moneda base, y
 * sumarlo como cero pintaría un día más claro de lo que es (`CLAUDE.md` §
 * `needs_fx`). El conteo excluido lo declara el `NeedsFxBanner` de la lista.
 */
export function expenseTotalsByDay(transactions: Pick<TransactionRecord, "kind" | "amountBase" | "occurredAt">[]): Map<string, bigint> {
  const totals = new Map<string, bigint>();
  for (const tx of transactions) {
    const { bucket, magnitude } = classifyConsumption(tx);
    if (bucket !== "outflow") continue;
    const day = dayKeyOf(tx.occurredAt);
    totals.set(day, (totals.get(day) ?? 0n) + magnitude);
  }
  return totals;
}

/**
 * Los dos extremos de la rampa del heatmap, en porcentaje de mezcla de
 * `--data-1` sobre `--surface-1`.
 *
 * **El piso NO es cero.** Cero se reserva para el día en que no hubo ningún
 * gasto, que es información: la celda queda idéntica al fondo. Cualquier gasto,
 * por chico que sea, tiene que separarse de eso — antes el piso efectivo era
 * 8% y un gasto chico se leía igual que un día vacío. 10% es el mínimo que
 * dibuja el propio diseño (`docs/design/bloque-d-movimientos.html:457`).
 *
 * **El techo es 70% por contraste, no por gusto.** El número del día vive
 * DENTRO de la celda, y los tonos medios no admiten texto chico: medido con la
 * fórmula de luminancia relativa WCAG, entre 80% y 87% de mezcla ninguna tinta
 * llega a 4,5:1 —ni la clara ni la oscura, en ninguno de los dos temas—, así
 * que un techo más alto obligaría a invertir la tinta Y a saltear esa banda,
 * dejando un escalón visible en una rampa que debe ser continua. A 70% el
 * número queda en 5,5:1 en claro y en oscuro con una sola tinta. Es además el
 * máximo que usa el diseño.
 */
export const HEAT_FLOOR = 10;
export const HEAT_CEILING = 70;

/**
 * Cuánto color le toca a un día, en porcentaje de mezcla.
 *
 * **Raíz cuadrada y no lineal.** El gasto diario tiene una distribución muy
 * sesgada —pocos días caros y muchos chicos—, así que normalizar linealmente
 * contra el máximo del mes aplasta a casi todos contra el piso: en un mes
 * 1000/300/150/80/40/20 los cuatro más chicos caían entre 11% y 15%,
 * indistinguibles entre sí. La raíz levanta la zona baja sin perder el
 * significado de magnitud: un día más caro siempre pinta más que uno más
 * barato, que es lo que un ranking por cuantiles sí rompería.
 *
 * `maxTotal` es el máximo del MES VISIBLE, no el histórico: contra el máximo
 * global un mes tranquilo se vería entero en blanco, y la comparación entre
 * sus días —que es para lo que sirve el heatmap— se perdería.
 */
export function heatMixPercent(total: bigint, maxTotal: number): number {
  if (total <= 0n) return 0;
  const ratio = Math.sqrt(Number(total) / Math.max(1, maxTotal));
  return HEAT_FLOOR + Math.min(1, ratio) * (HEAT_CEILING - HEAT_FLOOR);
}

/**
 * El rango de un preset del sheet de filtros.
 *
 * Vive acá y no en la pantalla porque comparte `localMidnightIso` con el
 * calendario: son dos formas de producir el MISMO tipo de límite, y tenerlas
 * en archivos distintos es cómo se desincronizan.
 */
export function periodStartFor(preset: DatePreset, now: Date): { from?: string; to?: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  switch (preset) {
    case "today":
      return { from: localMidnightIso(y, m, d), to: localMidnightIso(y, m, d + 1) };
    case "this-month":
      return { from: localMidnightIso(y, m, 1) };
    case "last-month":
      return { from: localMidnightIso(y, m - 1, 1), to: localMidnightIso(y, m, 1) };
    case "last-7":
      return { from: localMidnightIso(y, m, d - 6) };
    case "last-30":
      return { from: localMidnightIso(y, m, d - 29) };
    default:
      return {};
  }
}
