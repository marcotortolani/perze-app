"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  Wallet,
  Plus,
  TrendingUp,
  Bitcoin,
  Building,
  FileText,
  PiggyBank,
  MoreHorizontal,
  LineChart,
  ArrowRight,
} from "lucide-react"
import { parseISO } from "date-fns"

import { useTransactionsStore } from "@/stores/transactions-store"
import { useSettingsStore } from "@/stores/settings-store"
import { useRatesStore } from "@/stores/rates-store"
import { useCategoriesStore } from "@/stores/categories-store"
import { groupByCategory } from "@/lib/aggregations"
import { convertAmount, formatMoney } from "@/lib/money"
import { DEFAULT_CURRENCIES, DEFAULT_CATEGORIES, type Category } from "@/lib/types"

// ─── Icon map for investment categories ───────────────────────────────────────

const INVESTMENT_ICONS: Record<string, React.ElementType> = {
  stocks: LineChart,
  crypto: Bitcoin,
  "real-estate": Building,
  bonds: FileText,
  savings: PiggyBank,
  "other-investment": MoreHorizontal,
}

function getCategoryIcon(categoryId: string): React.ElementType {
  return INVESTMENT_ICONS[categoryId] ?? Wallet
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function DistributionBar({
  segments,
}: {
  segments: { color: string; pct: number }[]
}) {
  return (
    <div className="h-2.5 rounded-full overflow-hidden flex w-full">
      {segments.map((seg, idx) => (
        <div
          key={idx}
          style={{ width: `${seg.pct}%`, background: seg.color }}
          className="transition-all duration-500"
        />
      ))}
    </div>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({
  category,
  total,
  count,
  pct,
  displayCurrencyCode,
  displayCurrency,
  isLast,
}: {
  category: Category
  total: number
  count: number
  pct: number
  displayCurrencyCode: string
  displayCurrency: { code: string; symbol: string; decimals: number; name: string }
  isLast: boolean
}) {
  const Icon = getCategoryIcon(category.id)

  return (
    <div
      className="px-4 py-4"
      style={!isLast ? { borderBottom: "1px solid var(--border)" } : undefined}
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${category.color}22` }}
        >
          <Icon className="w-5 h-5" style={{ color: category.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-sm font-semibold text-foreground">{category.name}</p>
            <p className="text-sm font-bold text-foreground">
              {formatMoney(total, displayCurrency)}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {count} {count === 1 ? "movimiento" : "movimientos"}
            </p>
            <p className="text-xs font-semibold" style={{ color: category.color }}>
              {pct.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Mini progress */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: category.color }}
        />
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div
        className="w-24 h-24 rounded-3xl flex items-center justify-center mb-5"
        style={{
          background: "linear-gradient(135deg, color-mix(in oklch, var(--investment) 20%, transparent), color-mix(in oklch, var(--investment) 8%, transparent))",
          border: "1px solid color-mix(in oklch, var(--investment) 25%, transparent)",
        }}
      >
        <Wallet className="w-10 h-10" style={{ color: "var(--investment)" }} />
      </div>

      <h3 className="text-lg font-bold text-foreground mb-2">Sin inversiones</h3>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed max-w-xs">
        Registrá tus inversiones como movimientos de tipo Inversión para verlas aquí.
      </p>

      <Link
        href="/movimientos?new=true&type=investment"
        className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-white transition-all active:scale-95"
        style={{ background: "var(--investment)" }}
      >
        <Plus className="w-4 h-4" />
        Registrar inversión
      </Link>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InversionesPage() {
  const { transactions } = useTransactionsStore()
  const { displayCurrencyCode, currencies } = useSettingsStore()
  const { rates } = useRatesStore()
  const { categories } = useCategoriesStore()

  const allCurrencies = currencies.length > 0 ? currencies : DEFAULT_CURRENCIES
  const allCategories = categories.length > 0 ? categories : DEFAULT_CATEGORIES

  const displayCurrency =
    allCurrencies.find((c) => c.code === displayCurrencyCode) ?? allCurrencies[0]

  // Only investment transactions
  const investmentTx = useMemo(
    () => transactions.filter((t) => t.type === "investment"),
    [transactions]
  )

  // Total invested (in display currency)
  const totalInvested = useMemo(() => {
    return investmentTx.reduce((acc, t) => {
      const converted = convertAmount(t.amount, t.currencyCode, displayCurrencyCode, rates)
      return acc + (converted ?? 0)
    }, 0)
  }, [investmentTx, displayCurrencyCode, rates])

  // Group by category
  const byCategory = useMemo(
    () => groupByCategory(investmentTx, "investment", displayCurrencyCode, rates),
    [investmentTx, displayCurrencyCode, rates]
  )

  // Enrich with category data
  const enrichedCategories = useMemo(() => {
    return byCategory.map(({ categoryId, total, count }) => {
      const category =
        allCategories.find((c) => c.id === categoryId) ??
        ({ id: categoryId, name: categoryId, icon: "Wallet", color: "#6b7280", type: "investment" } as Category)
      const pct = totalInvested > 0 ? (total / totalInvested) * 100 : 0
      return { category, total, count, pct }
    })
  }, [byCategory, allCategories, totalInvested])

  // Distribution bar segments
  const barSegments = enrichedCategories.map((e) => ({
    color: e.category.color,
    pct: e.pct,
  }))

  const hasInvestments = investmentTx.length > 0

  return (
    <div className="pb-24">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-12 pb-5">
        <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase mb-0.5">
          Patrimonio
        </p>
        <h1 className="text-2xl font-black text-foreground tracking-tight">
          Inversiones
        </h1>
      </div>

      {/* ── Hero card ─────────────────────────────────────────────────────────── */}
      <div className="px-4 mb-5">
        <div
          className="rounded-3xl p-5 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, color-mix(in oklch, var(--investment) 80%, oklch(0.1 0.02 265)), color-mix(in oklch, var(--investment) 55%, oklch(0.08 0.04 265)))",
          }}
        >
          {/* Decorative */}
          <div
            className="absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-20 blur-2xl"
            style={{ background: "oklch(0.98 0 0)" }}
          />

          <div className="relative z-10">
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-1"
              style={{ color: "oklch(0.98 0 0 / 65%)" }}
            >
              Total invertido
            </p>
            <p
              className="text-4xl font-black tracking-tight leading-none mb-4"
              style={{ color: "oklch(0.98 0 0)" }}
            >
              {formatMoney(totalInvested, displayCurrency)}
            </p>

            <div className="flex items-center gap-3">
              <div
                className="rounded-2xl px-3 py-2"
                style={{ background: "oklch(0 0 0 / 18%)" }}
              >
                <p className="text-xs font-medium" style={{ color: "oklch(0.98 0 0 / 65%)" }}>
                  Movimientos
                </p>
                <p className="text-sm font-bold" style={{ color: "oklch(0.98 0 0)" }}>
                  {investmentTx.length}
                </p>
              </div>
              <div
                className="rounded-2xl px-3 py-2"
                style={{ background: "oklch(0 0 0 / 18%)" }}
              >
                <p className="text-xs font-medium" style={{ color: "oklch(0.98 0 0 / 65%)" }}>
                  Categorías
                </p>
                <p className="text-sm font-bold" style={{ color: "oklch(0.98 0 0)" }}>
                  {byCategory.length}
                </p>
              </div>
              <div
                className="rounded-2xl px-3 py-2"
                style={{ background: "oklch(0 0 0 / 18%)" }}
              >
                <p className="text-xs font-medium" style={{ color: "oklch(0.98 0 0 / 65%)" }}>
                  Moneda
                </p>
                <p className="text-sm font-bold" style={{ color: "oklch(0.98 0 0)" }}>
                  {displayCurrencyCode}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      {!hasInvestments ? (
        <EmptyState />
      ) : (
        <>
          {/* Distribution bar */}
          {barSegments.length > 1 && (
            <div className="px-4 mb-5">
              <div
                className="rounded-3xl p-4"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              >
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Distribución
                </p>
                <DistributionBar segments={barSegments} />
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                  {enrichedCategories.map(({ category, pct }) => (
                    <div key={category.id} className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0"
                        style={{ background: category.color }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {category.name}
                        <span className="font-semibold text-foreground ml-1">
                          {pct.toFixed(0)}%
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Category list */}
          <div className="px-4 mb-5">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Por categoría
            </h2>
            <div
              className="rounded-3xl overflow-hidden"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              {enrichedCategories.map(({ category, total, count, pct }, idx) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  total={total}
                  count={count}
                  pct={pct}
                  displayCurrencyCode={displayCurrencyCode}
                  displayCurrency={displayCurrency}
                  isLast={idx === enrichedCategories.length - 1}
                />
              ))}
            </div>
          </div>

          {/* Recent investment transactions */}
          <div className="px-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Movimientos
              </h2>
              <Link
                href="/movimientos?type=investment"
                className="flex items-center gap-0.5 text-xs font-semibold"
                style={{ color: "var(--investment)" }}
              >
                Ver todos
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div
              className="rounded-3xl overflow-hidden"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              {investmentTx.slice(0, 5).map((tx, idx) => {
                const cat =
                  allCategories.find((c) => c.id === tx.categoryId) ??
                  allCategories.find((c) => c.id === "other-investment")
                const txCurrency =
                  allCurrencies.find((c) => c.code === tx.currencyCode) ?? allCurrencies[0]
                const Icon = cat ? getCategoryIcon(cat.id) : Wallet
                const isLast = idx === Math.min(investmentTx.length, 5) - 1

                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 px-4 py-3.5"
                    style={!isLast ? { borderBottom: "1px solid var(--border)" } : undefined}
                  >
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: cat ? `${cat.color}22` : "var(--muted)" }}
                    >
                      <Icon className="w-5 h-5" style={{ color: cat?.color ?? "var(--investment)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {tx.description || cat?.name || "Inversión"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {cat?.name} · {tx.date}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold" style={{ color: "var(--investment)" }}>
                        {formatMoney(tx.amount, txCurrency)}
                      </p>
                      <p className="text-xs text-muted-foreground">{tx.currencyCode}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── FAB ───────────────────────────────────────────────────────────────── */}
      <Link
        href="/movimientos?new=true&type=investment"
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95"
        style={{
          background: "var(--investment)",
          color: "white",
          boxShadow: "0 4px 20px color-mix(in oklch, var(--investment) 40%, transparent)",
        }}
        aria-label="Nueva inversión"
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </Link>
    </div>
  )
}
