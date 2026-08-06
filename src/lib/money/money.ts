import { decimalsFor } from "./decimals";

export type CurrencyCode = string;

/** Plata: `bigint` en unidades mínimas (centavos, satoshis, …). Nunca `number`. */
export interface Money {
  readonly amount: bigint;
  readonly currency: CurrencyCode;
}

export class CurrencyMismatchError extends Error {
  constructor(a: CurrencyCode, b: CurrencyCode) {
    super(`No se puede operar entre monedas distintas: ${a} y ${b}`);
    this.name = "CurrencyMismatchError";
  }
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency);
}

export function money(amount: bigint, currency: CurrencyCode): Money {
  return { amount, currency };
}

export function zero(currency: CurrencyCode): Money {
  return { amount: 0n, currency };
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount - b.amount, currency: a.currency };
}

export function negate(a: Money): Money {
  return { amount: -a.amount, currency: a.currency };
}

export function abs(a: Money): Money {
  return { amount: a.amount < 0n ? -a.amount : a.amount, currency: a.currency };
}

export function isZero(a: Money): boolean {
  return a.amount === 0n;
}

export function isNegative(a: Money): boolean {
  return a.amount < 0n;
}

export function isPositive(a: Money): boolean {
  return a.amount > 0n;
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.amount < b.amount) return -1;
  if (a.amount > b.amount) return 1;
  return 0;
}

export function equals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amount === b.amount;
}

export function sum(currency: CurrencyCode, items: readonly Money[]): Money {
  return items.reduce((acc, m) => add(acc, m), zero(currency));
}

/**
 * Redondeo bancario (half-to-even) explícito. `numerator / denominator`,
 * ambos enteros — se usa para escalar por un factor (múltiplo, split entre
 * N) sin nunca pasar por `number`/`float`.
 */
export function roundHalfEven(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new Error("División por cero");
  const negative = (numerator < 0n) !== (denominator < 0n);
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;

  const quotient = n / d;
  const remainder = n % d;
  const twiceRemainder = remainder * 2n;

  let rounded = quotient;
  if (twiceRemainder > d) {
    rounded += 1n;
  } else if (twiceRemainder === d) {
    // half-to-even: solo sube si el cociente actual es impar
    if (quotient % 2n !== 0n) rounded += 1n;
  }

  return negative ? -rounded : rounded;
}

/**
 * Multiplica por un factor entero expresado como fracción `numerator/denominator`
 * (p. ej. multiplicar × 3 = 3n/1n; dividir entre 4 = 1n/4n). Nunca recibe un
 * `number` de punto flotante.
 */
export function scaleByFraction(a: Money, numerator: bigint, denominator: bigint): Money {
  return { amount: roundHalfEven(a.amount * numerator, denominator), currency: a.currency };
}

/**
 * Reparte `a` en `parts` partes lo más iguales posible, sin perder ni un
 * centavo: el resto (si no divide exacto) se reparte de a uno entre las
 * primeras partes. `sum(result) === a` siempre.
 */
export function splitEvenly(a: Money, parts: number): Money[] {
  if (parts <= 0) throw new Error("splitEvenly necesita al menos 1 parte");
  const base = a.amount / BigInt(parts);
  const remainder = a.amount % BigInt(parts);
  return Array.from({ length: parts }, (_, i) =>
    money(base + (BigInt(i) < remainder ? 1n : 0n), a.currency)
  );
}

/** Unidades mínimas → unidades mayores, como número — SOLO para mostrar, nunca para calcular. */
export function toMajorUnitsUnsafe(a: Money): number {
  const d = decimalsFor(a.currency);
  return Number(a.amount) / 10 ** d;
}

/**
 * Unidades mayores (`number`) → unidades mínimas (`bigint`) — el inverso
 * de `toMajorUnitsUnsafe`, para el caso contrario: un `numeric` que ya
 * llega en unidades mayores (`price_snapshots.close`, `trades.price`, una
 * cotización de API) y hay que envolver en `Money` para mostrarlo con
 * `<Amount>`/`formatAmountCompact`. D45 — pasar ese valor directo a
 * `BigInt(Math.round(...))` sin escalarlo es exactamente el bug que hizo
 * que un CEDEAR de $24.660 se mostrara como "$246,60": el bigint quedaba
 * interpretado como si ya fueran centavos. SOLO para envolver un dato
 * externo para mostrarlo, nunca para cálculos contables (que siguen
 * siempre en bigint de punta a punta).
 */
export function fromMajorUnitsUnsafe(value: number, currency: CurrencyCode): bigint {
  const d = decimalsFor(currency);
  return BigInt(Math.round(value * 10 ** d));
}
