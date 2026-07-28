import { decimalsFor } from "./decimals";
import type { Money } from "./money";
import type { NumberLocale } from "./parse";

export const CURRENCY_SYMBOLS: Record<string, string> = {
  UYU: "$",
  ARS: "AR$",
  USD: "US$",
  EUR: "€",
  BRL: "R$",
  CLP: "CLP$",
  MXN: "MX$",
  BTC: "₿",
  USDT: "USDT",
  USDC: "USDC",
};

function decimalSeparator(locale: NumberLocale): string {
  return locale === "en-US" ? "." : ",";
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

  const intFormatted = new Intl.NumberFormat(locale).format(intPart);
  const fracFormatted = decimals > 0 ? fracPart.toString().padStart(decimals, "0") : "";

  const sign = negative ? "−" : showSign ? "+" : "";
  const symbol = showSymbol ? `${CURRENCY_SYMBOLS[m.currency.toUpperCase()] ?? m.currency} ` : "";
  const decimalPart = decimals > 0 ? `${decimalSeparator(locale)}${fracFormatted}` : "";

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
      const dec = decimalSeparator(locale);
      return `${sign}${symbol}${whole}${dec}${tenth} ${suffix}`;
    }
  }

  return formatAmount(m, opts);
}
