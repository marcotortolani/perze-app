import { decimalsFor } from "../money/decimals";
import { money, type Money, roundHalfEven } from "../money/money";

/** Precisión interna del rate — coincide con `numeric(24,12)` del schema. */
export const RATE_DECIMALS = 12;
export const RATE_SCALE = 10n ** BigInt(RATE_DECIMALS);

/**
 * Un rate "escalado": el valor decimal del tipo de cambio representado
 * como bigint × `RATE_SCALE`. Es el formato interno de `fx_rate`/
 * `counter_fx_rate` — nunca se guarda ni se opera como `number`.
 */
export type ScaledRate = bigint;

/** Parsea un decimal plano ("1234.567890123456", formato interno — no de usuario) a rate escalado. */
export function parseRate(raw: string): ScaledRate {
  const negative = raw.startsWith("-");
  const s = negative ? raw.slice(1) : raw;
  const [intPartRaw, fracPartRaw = ""] = s.split(".");
  const intPart = intPartRaw || "0";
  const frac = fracPartRaw.padEnd(RATE_DECIMALS, "0").slice(0, RATE_DECIMALS);
  const digits = `${intPart}${frac}`.replace(/^0+(?=\d)/, "");
  return BigInt((negative ? "-" : "") + digits);
}

/** Inverso de `parseRate` — para persistir o mostrar el rate crudo. */
export function formatRate(scaled: ScaledRate): string {
  const negative = scaled < 0n;
  const abs = negative ? -scaled : scaled;
  const s = abs.toString().padStart(RATE_DECIMALS + 1, "0");
  const intPart = s.slice(0, -RATE_DECIMALS);
  const fracPart = s.slice(-RATE_DECIMALS);
  return `${negative ? "-" : ""}${intPart}.${fracPart}`;
}

/**
 * `formatRate` a los 12 decimales internos nunca es lo que un usuario tiene
 * que leer (su propio comentario ya lo dice). Trunca —no redondea, mismo
 * criterio que ya usaba `RateRow`— a `decimals` dígitos para mostrar.
 */
export function formatRateShort(scaled: ScaledRate, decimals = 2): string {
  const [intPart, fracPart = ""] = formatRate(scaled).split(".");
  return `${intPart}.${fracPart.slice(0, decimals).padEnd(decimals, "0")}`;
}

export function rateFromInteger(n: number): ScaledRate {
  return BigInt(n) * RATE_SCALE;
}

/** `1 / rate`, útil cuando un proveedor cotiza el par en la dirección opuesta. */
export function invertRate(rate: ScaledRate): ScaledRate {
  if (rate === 0n) throw new Error("No se puede invertir un rate en cero");
  return roundHalfEven(RATE_SCALE * RATE_SCALE, rate);
}

/**
 * Convierte `amount` (en su moneda) a `toCurrency` usando `rate` = cuántas
 * unidades de `toCurrency` equivalen a 1 unidad de `amount.currency`.
 * Fixed-point puro: nunca pasa por `number`. Ajusta por la diferencia de
 * decimales entre las dos monedas (p. ej. ARS 2 decimales → JPY 0).
 */
export function convert(amount: Money, toCurrency: string, rate: ScaledRate): Money {
  if (amount.currency === toCurrency) return amount;

  const fromDecimals = decimalsFor(amount.currency);
  const toDecimals = decimalsFor(toCurrency);
  const decimalsDiff = toDecimals - fromDecimals;

  let numerator = amount.amount * rate;
  let denominator = RATE_SCALE;

  if (decimalsDiff >= 0) {
    numerator *= 10n ** BigInt(decimalsDiff);
  } else {
    denominator *= 10n ** BigInt(-decimalsDiff);
  }

  return money(roundHalfEven(numerator, denominator), toCurrency);
}
