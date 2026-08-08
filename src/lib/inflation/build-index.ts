import type { PriceIndexPoint } from "@/lib/analytics/inflation";

export interface MonthlyChange {
  /** "YYYY-MM" */
  period: string;
  /** Variación mensual en % (ej. 1.9 = +1,9%), como la publica la fuente. */
  momPct: number;
}

/**
 * La serie completa de ArgentinaDatos arranca en 1943 — componerla entera
 * desborda `numeric(24,12)` (`price_index.index_value`): la inflación
 * acumulada de Argentina desde 1943 es ~3,85×10¹⁸, muy por encima del
 * ~10¹² que entra en la columna. No es un artefacto de la fuente (no hay
 * salto espurio en el empalme de 1992, verificado contra la API en vivo):
 * es la magnitud real de ocho décadas de hiperinflaciones acumuladas.
 * `MIN_INFLATION_PERIOD` ancla la serie en enero de 1992 (Plan de
 * Convertibilidad, el peso que sigue circulando hoy) — a esa fecha el
 * índice llega a ~95.000 para 2026, con margen de sobra para décadas. El
 * caller (`buildIndex` del lado del Edge Function) filtra `changes` a este
 * punto de arranque antes de pasarlo acá.
 */
export const MIN_INFLATION_PERIOD = "1992-01";

/**
 * H7 — ArgentinaDatos (y el IPC en general) publica variación mensual, no
 * un número índice. Para reexpresar un monto de cualquier mes en "pesos de
 * hoy" (`adjustForInflation`) hace falta un nivel encadenado, no el % suelto.
 * Se compone con base 100 en el primer período de la serie: el valor
 * absoluto del ancla es arbitrario (`adjustForInflation` solo usa
 * cocientes entre dos períodos), lo único que importa es no saltear ningún
 * mes de la cadena — un hueco ahí invalida todos los cocientes que lo
 * cruzan. `changes` tiene que venir ordenado cronológicamente y sin huecos
 * (la fuente hoy no los tiene — ver el research de ArgentinaDatos — pero
 * si algún día aparece uno, la fila de ese mes simplemente no se emite en
 * vez de inventar una interpolación, mismo criterio que `needs_fx`).
 */
export function buildPriceIndexFromMonthlyChanges(changes: readonly MonthlyChange[]): PriceIndexPoint[] {
  const sorted = [...changes].sort((a, b) => a.period.localeCompare(b.period));
  const points: PriceIndexPoint[] = [];
  let level = 100;
  for (const [i, change] of sorted.entries()) {
    if (i > 0) level *= 1 + change.momPct / 100;
    points.push({ period: change.period, indexValue: level });
  }
  return points;
}
