import type { Currency, ExchangeRate } from "./types"

/**
 * Format a monetary amount with proper locale, symbol and decimals.
 * Uses Intl.NumberFormat for correct grouping separators.
 */
export function formatMoney(
  amount: number,
  currency: Currency,
  locale = "es-AR"
): string {
  const sign = amount < 0 ? "-" : ""
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(Math.abs(amount))

  return `${sign}${currency.symbol}${formatted}`
}

/**
 * Convert an amount from one currency to another using USD as a pivot.
 * Returns null if a required rate is missing.
 *
 * Formula:
 *   amountInUSD = amount / fromRate.perUSD
 *   result      = amountInUSD * toRate.perUSD
 */
export function convertAmount(
  amount: number,
  fromCurrencyCode: string,
  toCurrencyCode: string,
  rates: ExchangeRate[]
): number | null {
  if (fromCurrencyCode === toCurrencyCode) return amount

  const fromRate = rates.find((r) => r.currencyCode === fromCurrencyCode)
  const toRate = rates.find((r) => r.currencyCode === toCurrencyCode)

  if (!fromRate || !toRate) return null
  if (fromRate.perUSD === 0) return null

  const amountInUSD = amount / fromRate.perUSD
  return amountInUSD * toRate.perUSD
}

/**
 * Format a currency amount compactly for display.
 * Examples: $1.2M, $500K, $1.5B
 */
export function formatCompact(amount: number, currency: Currency): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? "-" : ""

  let value: number
  let suffix: string

  if (abs >= 1_000_000_000) {
    value = abs / 1_000_000_000
    suffix = "B"
  } else if (abs >= 1_000_000) {
    value = abs / 1_000_000
    suffix = "M"
  } else if (abs >= 1_000) {
    value = abs / 1_000
    suffix = "K"
  } else {
    // Below 1 000 — use standard formatting with up to 2 decimal places
    const formatted = new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.min(currency.decimals, 2),
    }).format(abs)
    return `${sign}${currency.symbol}${formatted}`
  }

  // Trim unnecessary trailing zeros (e.g. 1.20 → 1.2, 1.00 → 1)
  const decimalPlaces = value % 1 === 0 ? 0 : 1
  const formattedValue = value.toFixed(decimalPlaces)

  return `${sign}${currency.symbol}${formattedValue}${suffix}`
}

/**
 * Return a display string for a currency, including the code when the symbol
 * is ambiguous (e.g. "$" is used by USD, ARS, UYU).
 */
export function getCurrencyDisplay(currency: Currency): string {
  // Ambiguous symbols — append the code for clarity
  const ambiguousSymbols = ["$", "$U"]
  if (ambiguousSymbols.includes(currency.symbol)) {
    return `${currency.symbol} (${currency.code})`
  }
  return currency.symbol
}
