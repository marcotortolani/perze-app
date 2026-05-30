import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns"
import { es } from "date-fns/locale"
import type { Transaction, ExchangeRate, TransactionType } from "./types"
import { convertAmount } from "./money"

// ─── Filter interface ──────────────────────────────────────────────────────────

export interface TransactionFilters {
  type?: TransactionType | "all"
  countryCode?: string
  currencyCode?: string
  categoryId?: string
  dateFrom?: string // ISO date
  dateTo?: string // ISO date
  search?: string
}

// ─── Aggregation result types ─────────────────────────────────────────────────

export interface Totals {
  income: number
  expenses: number
  investments: number
  net: number // income - expenses - investments
}

// ─── Filter transactions ───────────────────────────────────────────────────────

export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters
): Transaction[] {
  return transactions.filter((t) => {
    // type filter
    if (filters.type && filters.type !== "all" && t.type !== filters.type) {
      return false
    }

    // country filter
    if (filters.countryCode && t.countryCode !== filters.countryCode) {
      return false
    }

    // currency filter
    if (filters.currencyCode && t.currencyCode !== filters.currencyCode) {
      return false
    }

    // category filter
    if (filters.categoryId && t.categoryId !== filters.categoryId) {
      return false
    }

    // date range filter
    if (filters.dateFrom || filters.dateTo) {
      const txDate = parseISO(t.date)
      if (filters.dateFrom) {
        const from = startOfDay(parseISO(filters.dateFrom))
        if (txDate < from) return false
      }
      if (filters.dateTo) {
        const to = endOfDay(parseISO(filters.dateTo))
        if (txDate > to) return false
      }
    }

    // text search — matches description, notes, or tags
    if (filters.search) {
      const needle = filters.search.toLowerCase()
      const inDescription = t.description.toLowerCase().includes(needle)
      const inNotes = t.notes?.toLowerCase().includes(needle) ?? false
      const inTags = t.tags?.some((tag) => tag.toLowerCase().includes(needle)) ?? false
      if (!inDescription && !inNotes && !inTags) return false
    }

    return true
  })
}

// ─── Compute totals ────────────────────────────────────────────────────────────

export function computeTotals(
  transactions: Transaction[],
  targetCurrencyCode: string,
  rates: ExchangeRate[]
): Totals {
  const totals: Totals = { income: 0, expenses: 0, investments: 0, net: 0 }

  for (const t of transactions) {
    const converted = convertAmount(t.amount, t.currencyCode, targetCurrencyCode, rates)
    if (converted === null) continue // skip if rate unavailable

    if (t.type === "income") totals.income += converted
    else if (t.type === "expense") totals.expenses += converted
    else if (t.type === "investment") totals.investments += converted
  }

  totals.net = totals.income - totals.expenses - totals.investments
  return totals
}

// ─── Group by month ────────────────────────────────────────────────────────────

export function groupByMonth(
  transactions: Transaction[],
  targetCurrencyCode: string,
  rates: ExchangeRate[]
): Array<{
  month: string // "2024-01"
  label: string // "Ene 2024"
  income: number
  expenses: number
  investments: number
}> {
  const map = new Map<
    string,
    { income: number; expenses: number; investments: number }
  >()

  for (const t of transactions) {
    const month = t.date.slice(0, 7) // "YYYY-MM"
    if (!map.has(month)) {
      map.set(month, { income: 0, expenses: 0, investments: 0 })
    }

    const converted = convertAmount(t.amount, t.currencyCode, targetCurrencyCode, rates)
    if (converted === null) continue

    const entry = map.get(month)!
    if (t.type === "income") entry.income += converted
    else if (t.type === "expense") entry.expenses += converted
    else if (t.type === "investment") entry.investments += converted
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, totals]) => {
      const date = parseISO(`${month}-01`)
      const label = format(date, "MMM yyyy", { locale: es })
      return { month, label: label.charAt(0).toUpperCase() + label.slice(1), ...totals }
    })
}

// ─── Group by category ─────────────────────────────────────────────────────────

export function groupByCategory(
  transactions: Transaction[],
  type: TransactionType,
  targetCurrencyCode: string,
  rates: ExchangeRate[]
): Array<{ categoryId: string; total: number; count: number }> {
  const map = new Map<string, { total: number; count: number }>()

  for (const t of transactions) {
    if (t.type !== type) continue

    const converted = convertAmount(t.amount, t.currencyCode, targetCurrencyCode, rates)
    if (converted === null) continue

    if (!map.has(t.categoryId)) {
      map.set(t.categoryId, { total: 0, count: 0 })
    }

    const entry = map.get(t.categoryId)!
    entry.total += converted
    entry.count += 1
  }

  return Array.from(map.entries())
    .map(([categoryId, data]) => ({ categoryId, ...data }))
    .sort((a, b) => b.total - a.total)
}

// ─── Group by country ──────────────────────────────────────────────────────────

export function groupByCountry(
  transactions: Transaction[],
  targetCurrencyCode: string,
  rates: ExchangeRate[]
): Array<{
  countryCode: string
  income: number
  expenses: number
  investments: number
}> {
  const map = new Map<
    string,
    { income: number; expenses: number; investments: number }
  >()

  for (const t of transactions) {
    if (!map.has(t.countryCode)) {
      map.set(t.countryCode, { income: 0, expenses: 0, investments: 0 })
    }

    const converted = convertAmount(t.amount, t.currencyCode, targetCurrencyCode, rates)
    if (converted === null) continue

    const entry = map.get(t.countryCode)!
    if (t.type === "income") entry.income += converted
    else if (t.type === "expense") entry.expenses += converted
    else if (t.type === "investment") entry.investments += converted
  }

  return Array.from(map.entries()).map(([countryCode, totals]) => ({
    countryCode,
    ...totals,
  }))
}
