/**
 * I10 — XIRR (tasa interna de retorno anualizada con flujos en fechas
 * irregulares). Newton-Raphson sobre los flujos reales de `trades`
 * (`amount_base`, con signo por tipo de operación) más el valor de
 * mercado actual de la posición como flujo final positivo — sin eso, no
 * hay "retorno", solo compras.
 */

export interface CashFlow {
  date: Date;
  amount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function npv(rate: number, flows: readonly CashFlow[], t0: Date): number {
  return flows.reduce((sum, f) => {
    const years = (f.date.getTime() - t0.getTime()) / (365 * DAY_MS);
    return sum + f.amount / Math.pow(1 + rate, years);
  }, 0);
}

function npvDerivative(rate: number, flows: readonly CashFlow[], t0: Date): number {
  return flows.reduce((sum, f) => {
    const years = (f.date.getTime() - t0.getTime()) / (365 * DAY_MS);
    if (years === 0) return sum;
    return sum - (years * f.amount) / Math.pow(1 + rate, years + 1);
  }, 0);
}

/** `null` si no converge (menos de 2 flujos, o todos del mismo signo — no hay tasa que iguale eso a cero). */
export function computeXirr(flows: readonly CashFlow[], guess = 0.1): number | null {
  if (flows.length < 2) return null;
  const hasPositive = flows.some((f) => f.amount > 0);
  const hasNegative = flows.some((f) => f.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const t0 = flows[0]!.date;
  let rate = guess;
  for (let i = 0; i < 100; i++) {
    const value = npv(rate, flows, t0);
    const derivative = npvDerivative(rate, flows, t0);
    if (derivative === 0) return null;
    const nextRate = rate - value / derivative;
    if (!Number.isFinite(nextRate)) return null;
    if (Math.abs(nextRate - rate) < 1e-7) return nextRate;
    rate = nextRate;
  }
  return null;
}
