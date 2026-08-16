import type { AccountRow } from "@/lib/db/schema";
import { computeTransactionEffects, type TransactionForEffects } from "@/lib/repos/balance-effects";
import { isCreditCardAccount } from "@/lib/analytics/card-cycle";
import { money, toMajorUnitsUnsafe, type CurrencyCode } from "@/lib/money/money";

export interface EvolutionPoint {
  /** ISO date (`YYYY-MM-DD`), sin hora — para mostrar se formatea aparte con el locale. */
  isoDate: string;
  /** En unidades mayores (p. ej. pesos, no centavos) — ver `fromMajorUnitsUnsafe` para volver a bigint. */
  value: number;
}

export type EvolutionTransaction = TransactionForEffects & { occurredAt: string };

export interface ComputeAccountEvolutionInput {
  account: Pick<AccountRow, "id" | "kind" | "openingBalance" | "openingDate" | "currencyCode">;
  /** Todas las transacciones donde la cuenta participa (lado `accountId` o `counterAccountId`), sin filtrar por ventana. */
  transactions: readonly EvolutionTransaction[];
  windowDays: number;
  now: Date;
}

/**
 * Reconstruye el saldo de una cuenta día a día desde `opening_balance`, no
 * desde `account.currentBalance`: ese campo lo puede pisar un pull en
 * background con un valor del servidor a medio recalcular mientras el
 * outbox todavía tiene movimientos en tránsito (`src/lib/offline/pull.ts`),
 * y arrastraba ese valor stale tanto al día de "hoy" como a todos los días
 * anteriores a la primera transacción real (D66). Sumar los efectos desde
 * `opening_balance` usa solo la lista local de transacciones — siempre al
 * día — y nunca depende de ese campo sincronizado.
 *
 * D66b — `opening_balance` no es cero: una cuenta puede arrancar con un
 * saldo real (dinero que ya existía en otro lado antes de empezar a
 * usar la app). Pero esa cifra solo es válida DESDE `opening_date` — antes
 * de esa fecha la cuenta directamente no existía, así que graficar una
 * recta plana en `opening_balance` para todo el resto de la ventana de 90
 * días (aunque la cuenta se haya creado hace 4 días) fabrica un dato: no
 * es que el saldo fuera ese, es que no hay saldo porque no había cuenta.
 * Sin `opening_date` (cuentas viejas migradas sin esa columna poblada) se
 * mantiene el comportamiento anterior, a falta de una fecha real de corte.
 */
export function computeAccountEvolution({ account, transactions, windowDays, now }: ComputeAccountEvolutionInput): EvolutionPoint[] {
  const windowStartIso = daysAgoIso(windowDays, now);

  let cursor = account.openingBalance;
  for (const t of transactions) {
    if (t.occurredAt >= windowStartIso) continue;
    const effect = computeTransactionEffects(t).find((e) => e.accountId === account.id);
    if (!effect) continue;
    cursor += effect.delta;
  }
  const startBalance = cursor;

  const deltaByDay = new Map<string, bigint>();
  for (const t of transactions) {
    if (t.occurredAt < windowStartIso) continue;
    const effect = computeTransactionEffects(t).find((e) => e.accountId === account.id);
    if (!effect) continue;
    const day = t.occurredAt.slice(0, 10);
    deltaByDay.set(day, (deltaByDay.get(day) ?? 0n) + effect.delta);
  }

  // Tarjeta de crédito: el saldo es negativo y crece hacia abajo a medida
  // que se gasta más — matemáticamente correcto, pero al revés de lo que se
  // quiere leer acá. Graficar `-saldo` (el consumo, siempre ≥ 0) deja la
  // línea subiendo cuando se gasta más y bajando cuando se paga.
  const sign = isCreditCardAccount(account) ? -1 : 1;

  const points: EvolutionPoint[] = [];
  let running = startBalance;
  for (let i = windowDays; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    running += deltaByDay.get(iso) ?? 0n;
    // La cuenta no existía antes de `opening_date` — ese punto no es un
    // saldo real, es la ausencia de cuenta. Se omite en vez de graficar
    // `opening_balance` como si hubiera estado ahí todo el tiempo.
    if (account.openingDate && iso < account.openingDate) continue;
    // Un punto por día, no por semana — el muestreo semanal (`i % 7 === 0`)
    // escondía movimientos puntuales de un día específico detrás de una
    // línea que solo se movía cada ~7 días, exactamente lo que esta
    // evolución debería mostrar. `LineChart` no dibuja un label por punto
    // (solo máximo/mínimo + tooltip del punto activo), así que no hay
    // amontonamiento por pasar de ~14 a hasta 91 puntos en 90 días.
    points.push({ isoDate: iso, value: sign * toMajorUnitsUnsafe(money(running, account.currencyCode as CurrencyCode)) });
  }
  return points;
}

function daysAgoIso(days: number, from: Date): string {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
