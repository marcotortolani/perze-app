import { decimalsFor } from "./decimals";
import type { Money } from "./money";
import type { NumberLocale } from "./parse";
import { currentSeparators, groupDigits } from "./number-format";

/**
 * ISO 4217 define el código de 3 letras y los decimales de cada moneda —
 * NO define símbolos: eso es una convención aparte (CLDR/uso real), y la
 * mayoría de las ~180 monedas del estándar no tienen uno propio y
 * reconocible. Esta tabla es una curaduría deliberada de las que sí lo
 * tienen — el resto cae al propio código ISO en `formatAmount`/
 * `formatAmountCompact` (`CURRENCY_SYMBOLS[code] ?? code`), que **es** la
 * forma correcta de mostrar una moneda sin símbolo, no un placeholder.
 * Ver `docs/00-producto.md`/`more/about` para la nota completa.
 */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  // "$U" es el símbolo tradicional para distinguir el peso uruguayo de
  // cualquier otro peso/dólar — antes caía al "$" genérico, indistinguible
  // del real de cualquier otro país en la misma lista (p. ej. junto a ARS).
  UYU: "$U",
  ARS: "AR$",
  USD: "US$",
  EUR: "€",
  BRL: "R$",
  CLP: "CLP$",
  MXN: "MX$",
  BTC: "₿",
  ETH: "Ξ",
  USDT: "USDT",
  USDC: "USDC",
  // Mismos códigos y símbolos que siembra
  // `supabase/migrations/20260802040000_seed_frankfurter_currencies.sql` —
  // cobertura real del proveedor `frankfurter` (BCE), no un recorte propio.
  AUD: "AU$",
  CAD: "CA$",
  CHF: "CHF",
  CNY: "CN¥",
  CZK: "Kč",
  DKK: "kr",
  GBP: "£",
  HKD: "HK$",
  HUF: "Ft",
  IDR: "Rp",
  ILS: "₪",
  INR: "₹",
  ISK: "kr",
  JPY: "¥",
  KRW: "₩",
  MYR: "RM",
  NOK: "kr",
  NZD: "NZ$",
  PHP: "₱",
  PLN: "zł",
  RON: "lei",
  SEK: "kr",
  SGD: "SG$",
  THB: "฿",
  TRY: "₺",
  ZAR: "R",
  // Resto de Latinoamérica — mercados vecinos de UY/AR, quedaban cayendo
  // al código ISO sin necesidad (sí tienen símbolo real y reconocido).
  PEN: "S/",
  BOB: "Bs",
  VES: "Bs.S",
  COP: "COL$",
  PYG: "₲",
  GTQ: "Q",
  DOP: "RD$",
  // Otras monedas con símbolo real y de uso frecuente fuera de la cobertura
  // Frankfurter/BCE.
  RUB: "₽",
  UAH: "₴",
  VND: "₫",
  PKR: "₨",
  EGP: "E£",
  NGN: "₦",
  BDT: "৳",
};

function separatorsFor(locale: NumberLocale) {
  return currentSeparators(locale !== "en-US");
}

export interface FormatAmountOptions {
  locale?: NumberLocale;
  /** Antepone `+`/`−` explícito. Los saldos y KPIs van con `false`. */
  showSign?: boolean;
  /** Muestra el código en vez del símbolo (para monedas sin símbolo conocido, siempre). */
  showSymbol?: boolean;
}

/**
 * El único formateador de plata de la app (junto al componente `<Amount>`
 * que lo envuelve). Separa entero y fracción con bigint puro — nunca pasa
 * por `Number()`/`parseFloat` sobre el monto completo.
 */
export function formatAmount(m: Money, opts: FormatAmountOptions = {}): string {
  const { locale = "es-UY", showSign = true, showSymbol = true } = opts;
  const decimals = decimalsFor(m.currency);
  const divisor = 10n ** BigInt(decimals);

  const negative = m.amount < 0n;
  const absAmount = negative ? -m.amount : m.amount;
  const intPart = absAmount / divisor;
  const fracPart = absAmount % divisor;

  const { decimal, group } = separatorsFor(locale);
  const intFormatted = groupDigits(intPart.toString(), group);
  const fracFormatted = decimals > 0 ? fracPart.toString().padStart(decimals, "0") : "";

  const sign = negative ? "−" : showSign ? "+" : "";
  const symbol = showSymbol ? `${CURRENCY_SYMBOLS[m.currency.toUpperCase()] ?? m.currency} ` : "";
  const decimalPart = decimals > 0 ? `${decimal}${fracFormatted}` : "";

  return `${sign}${symbol}${intFormatted}${decimalPart}`;
}

/**
 * Variante compacta ("1,2 M") para espacios chicos (sparklines, chips).
 * Solo entero + un decimal de magnitud, redondeo half-up simple sobre el
 * dígito de corte — nunca sobre el monto completo.
 */
export function formatAmountCompact(m: Money, opts: FormatAmountOptions = {}): string {
  const { locale = "es-UY", showSign = true, showSymbol = true } = opts;
  const decimals = decimalsFor(m.currency);
  const divisor = 10n ** BigInt(decimals);

  const negative = m.amount < 0n;
  const majorUnits = (negative ? -m.amount : m.amount) / divisor;

  const THRESHOLDS: Array<[bigint, string]> = [
    [1_000_000_000n, "MM"],
    [1_000_000n, "M"],
    [1_000n, "K"],
  ];

  const sign = negative ? "−" : showSign ? "+" : "";
  const symbol = showSymbol ? `${CURRENCY_SYMBOLS[m.currency.toUpperCase()] ?? m.currency} ` : "";

  for (const [threshold, suffix] of THRESHOLDS) {
    if (majorUnits >= threshold) {
      const scaledTenths = (majorUnits * 10n) / threshold;
      const whole = scaledTenths / 10n;
      const tenth = scaledTenths % 10n;
      const { decimal, group } = separatorsFor(locale);
      return `${sign}${symbol}${groupDigits(whole.toString(), group)}${decimal}${tenth} ${suffix}`;
    }
  }

  return formatAmount(m, opts);
}

export interface FormatNumberOptions {
  locale?: NumberLocale;
}

/**
 * Único formateador de CANTIDADES de instrumento (`number`, nunca
 * `bigint`) — dominio distinto de `formatAmount`. `decimals` es
 * obligatorio y sin default a propósito (contrato § 0): la precisión se
 * deriva con `decimalsForQuantity()` en el caller, nunca se asume acá.
 * Ningún componente de dinero llama a `toFixed()` — esto reemplaza esa
 * tentación para el caso de cantidades.
 */
export function formatNumber(value: number, decimals: number, opts: FormatNumberOptions = {}): string {
  const { locale = "es-UY" } = opts;
  const { decimal, group } = separatorsFor(locale);
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(decimals);
  const [intStr, fracStr = ""] = fixed.split(".");
  const decimalPart = decimals > 0 ? `${decimal}${fracStr}` : "";
  return `${negative ? "−" : ""}${groupDigits(intStr ?? "0", group)}${decimalPart}`;
}
