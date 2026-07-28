import { decimalsFor } from "./decimals";
import { type CurrencyCode, type Money, money } from "./money";

export type NumberLocale = "es-UY" | "es-AR" | "en-US" | "pt-BR";

/** es-*: coma decimal, punto de miles · en-US: al revés. */
function separatorsFor(locale: NumberLocale): { decimal: string; thousands: string } {
  return locale === "en-US" ? { decimal: ".", thousands: "," } : { decimal: ",", thousands: "." };
}

/**
 * Parsea un string tipeado por el usuario ("1.250,50", "1,250.50", "-40,5")
 * a `Money`. Puramente por manipulación de strings: nunca pasa por
 * `parseFloat`/`Number()` sobre el valor completo, así que no hay pérdida
 * de precisión posible.
 */
export function parseAmountString(
  raw: string,
  currency: CurrencyCode,
  locale: NumberLocale = "es-UY"
): Money {
  const { decimal, thousands } = separatorsFor(locale);
  const decimals = decimalsFor(currency);

  let s = raw.trim();
  const negative = s.startsWith("-");
  if (negative || s.startsWith("+")) s = s.slice(1);

  // sacar separador de miles
  s = s.split(thousands).join("");

  const [intPartRaw, fracPartRaw = ""] = s.split(decimal);
  const intPart = (intPartRaw ?? "").replace(/\D/g, "") || "0";
  const fracDigitsOnly = fracPartRaw.replace(/\D/g, "");

  const fracPadded =
    fracDigitsOnly.length >= decimals
      ? fracDigitsOnly.slice(0, decimals)
      : fracDigitsOnly.padEnd(decimals, "0");

  const digits = `${intPart}${fracPadded}`.replace(/^0+(?=\d)/, "");
  const amount = BigInt((negative ? "-" : "") + digits);

  return money(amount, currency);
}

/**
 * Parsea un multiplicador/divisor plano (cantidad, no plata) para las
 * operaciones × ÷ del keypad — p. ej. "3" en "450 × 3". Devuelve
 * numerador/denominador enteros para `scaleByFraction`, nunca un `number`
 * de punto flotante.
 */
export function parseScalarFraction(
  raw: string,
  locale: NumberLocale = "es-UY"
): { numerator: bigint; denominator: bigint } {
  const { decimal } = separatorsFor(locale);
  const thousands = separatorsFor(locale).thousands;
  let s = raw.trim().split(thousands).join("");
  const negative = s.startsWith("-");
  if (negative || s.startsWith("+")) s = s.slice(1);

  const [intPartRaw, fracPartRaw = ""] = s.split(decimal);
  const intPart = (intPartRaw ?? "").replace(/\D/g, "") || "0";
  const fracDigits = fracPartRaw.replace(/\D/g, "");

  if (fracDigits.length === 0) {
    const n = BigInt((negative ? "-" : "") + intPart);
    return { numerator: n, denominator: 1n };
  }

  const denominator = 10n ** BigInt(fracDigits.length);
  const numerator = BigInt((negative ? "-" : "") + `${intPart}${fracDigits}`);
  return { numerator, denominator };
}
