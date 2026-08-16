/**
 * Fase 4 auditoría — proyección de saldo 30/60/90 días: "cuánto vas a
 * tener disponible", sumando SOLO lo ya comprometido — mismo criterio que
 * `installment-projection.ts`: nunca una estimación de consumo nuevo, solo
 * lo que ya se sabe que va a pasar (cuotas pendientes, próximas
 * ocurrencias de recurrentes, renta fija contractual).
 *
 * Este módulo no resuelve FX ni toca ningún repo — cada `ProjectedEvent`
 * llega YA convertido a la moneda base del household (el caller hace esa
 * conversión con `resolveFxForAccountCurrency`, la misma cadena de
 * resolución que cualquier captura: override → cotización del día →
 * última conocida → `pending`). Acá solo se suma `bigint` en una sola
 * moneda y se arma la serie acumulada — la misma separación que
 * `computeMonthlyCommitted` (cálculo puro) vs. su wrapper async en
 * `recurring-schedule.ts`.
 */

export type ProjectedEventKind = "recurring-income" | "recurring-expense" | "installment-owed-to-me" | "installment-i-owe" | "fixed-income";

export interface ProjectedEvent {
  /** YYYY-MM-DD — día calendario en que se espera el movimiento. */
  date: string;
  label: string;
  /** Ya en moneda base. Positivo = entra, negativo = sale. */
  amount: bigint;
  kind: ProjectedEventKind;
}

export interface BalanceProjectionPoint {
  date: string;
  /** Saldo acumulado a esa fecha, en moneda base. */
  balance: bigint;
}

export interface HorizonSnapshot {
  horizonDays: number;
  /** Último día del horizonte (hoy + horizonDays). */
  date: string;
  /** Saldo proyectado a esa fecha. */
  balance: bigint;
  /** Suma de todo lo que entra hasta ese horizonte. */
  committedIn: bigint;
  /** Suma (en valor absoluto) de todo lo que sale hasta ese horizonte. */
  committedOut: bigint;
}

export interface BalanceProjection {
  currentBalance: bigint;
  /** Serie para graficar: arranca en `nowIso` con el saldo actual, un punto por evento después. */
  points: BalanceProjectionPoint[];
  /** Uno por horizonte pedido, en el mismo orden que se pidieron. */
  horizons: HorizonSnapshot[];
  /** Eventos considerados, ordenados por fecha — para el desglose "qué compone cada tramo". */
  events: ProjectedEvent[];
}

export const DEFAULT_HORIZONS_DAYS = [30, 60, 90] as const;

/** `nowIso + days`, sintetizado a mediodía UTC (D10) — nunca medianoche, que cae en el día anterior en husos negativos. */
export function addDaysIso(nowIso: string, days: number): string {
  const [y, m, d] = nowIso.split("-").map(Number) as [number, number, number];
  const noon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  noon.setUTCDate(noon.getUTCDate() + days);
  return noon.toISOString().slice(0, 10);
}

/**
 * Combina el saldo actual con los eventos ya comprometidos (recurrentes,
 * cuotas, renta fija) para armar la serie acumulada y el snapshot de cada
 * horizonte. Los eventos anteriores a `nowIso` se ignoran — son
 * responsabilidad del caller no mandarlos, pero un filtro defensivo acá
 * evita que un evento "vencido y no cargado todavía" duplique lo que el
 * saldo actual ya refleja.
 */
export function computeBalanceProjection(
  currentBalance: bigint,
  events: readonly ProjectedEvent[],
  nowIso: string,
  horizonsDays: readonly number[] = DEFAULT_HORIZONS_DAYS
): BalanceProjection {
  const sorted = [...events].filter((e) => e.date >= nowIso).sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));

  const points: BalanceProjectionPoint[] = [{ date: nowIso, balance: currentBalance }];
  let running = currentBalance;
  for (const event of sorted) {
    running += event.amount;
    points.push({ date: event.date, balance: running });
  }

  const horizons: HorizonSnapshot[] = horizonsDays.map((horizonDays) => {
    const cutoff = addDaysIso(nowIso, horizonDays);
    let balance = currentBalance;
    let committedIn = 0n;
    let committedOut = 0n;
    for (const event of sorted) {
      if (event.date > cutoff) break;
      balance += event.amount;
      if (event.amount > 0n) committedIn += event.amount;
      else committedOut += -event.amount;
    }
    return { horizonDays, date: cutoff, balance, committedIn, committedOut };
  });

  return { currentBalance, points, horizons, events: sorted };
}
