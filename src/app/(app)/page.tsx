"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Bell,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Plus,
  Sparkles,
  BarChart3,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, parseISO } from "date-fns"
import { es } from "date-fns/locale"

import { useTransactionsStore } from "@/stores/transactions-store"
import { useSettingsStore } from "@/stores/settings-store"
import { useRatesStore } from "@/stores/rates-store"
import { useCategoriesStore } from "@/stores/categories-store"
import { useAuthStore } from "@/stores/auth-store"

import { computeTotals, groupByMonth, groupByCountry } from "@/lib/aggregations"
import { formatMoney } from "@/lib/money"
import { DEFAULT_CURRENCIES, type TransactionType, DEFAULT_COUNTRIES } from "@/lib/types"

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "month" | "3months" | "year"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTransactionIcon(type: TransactionType) {
  if (type === "income")
    return <TrendingUp className="w-4 h-4" style={{ color: "var(--income)" }} />
  if (type === "expense")
    return <TrendingDown className="w-4 h-4" style={{ color: "var(--expense)" }} />
  return <Wallet className="w-4 h-4" style={{ color: "var(--investment)" }} />
}

function getGreeting(name?: string | null): string {
  const hour = new Date().getHours()
  const timeGreeting =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches"
  return name ? `${timeGreeting}, ${name.split(" ")[0]}` : "Finanzas"
}

function getInitials(name?: string | null): string {
  if (!name) return "?"
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function getPeriodRange(period: Period): { from: Date; to: Date } {
  const now = new Date()
  if (period === "month") {
    return { from: startOfMonth(now), to: endOfMonth(now) }
  }
  if (period === "3months") {
    return { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) }
  }
  // year
  return { from: startOfYear(now), to: endOfMonth(now) }
}

const PERIOD_LABELS: Record<Period, string> = {
  month: "Este mes",
  "3months": "3 meses",
  year: "Este año",
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.fill }}
          />
          <span className="text-muted-foreground capitalize">
            {entry.dataKey === "income" ? "Ingresos" : entry.dataKey === "expenses" ? "Gastos" : "Inversiones"}:
          </span>
          <span className="font-medium text-foreground">{entry.value?.toLocaleString("es-AR")}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {/* Illustration */}
      <div className="relative mb-6">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, color-mix(in oklch, var(--app-accent) 15%, transparent), color-mix(in oklch, var(--app-accent) 5%, transparent))",
            border: "1px solid color-mix(in oklch, var(--app-accent) 20%, transparent)",
          }}
        >
          <BarChart3
            className="w-10 h-10"
            style={{ color: "var(--app-accent)" }}
          />
        </div>
        <div
          className="absolute -top-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: "var(--app-accent)" }}
        >
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-2">
        Todo listo para empezar
      </h3>
      <p className="text-sm text-muted-foreground mb-8 max-w-xs leading-relaxed">
        Registrá tu primer movimiento y comenzá a ver tus finanzas en tiempo real.
      </p>

      <Link
        href="/movimientos?new=true&type=expense"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-sm transition-all active:scale-95"
        style={{
          background: "var(--app-accent)",
          color: "var(--app-accent-foreground)",
        }}
      >
        <Plus className="w-4 h-4" />
        Agregá tu primer movimiento
      </Link>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("month")
  const [displayCurrencyOverride, setDisplayCurrencyOverride] = useState<string | null>(null)

  // Stores
  const { transactions } = useTransactionsStore()
  const { displayCurrencyCode, currencies, countries } = useSettingsStore()
  const { rates } = useRatesStore()
  const { categories } = useCategoriesStore()
  const currentUser = useAuthStore((s) => s.currentUser)

  // Resolved display currency
  const activeCurrencyCode = displayCurrencyOverride ?? displayCurrencyCode
  const allCurrencies = currencies.length > 0 ? currencies : DEFAULT_CURRENCIES
  const activeCurrency =
    allCurrencies.find((c) => c.code === activeCurrencyCode) ?? allCurrencies[0]

  // Filter by period
  const { from, to } = getPeriodRange(period)
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const date = parseISO(t.date)
      return date >= from && date <= to
    })
  }, [transactions, from, to])

  // Totals
  const totals = useMemo(
    () => computeTotals(filteredTransactions, activeCurrencyCode, rates),
    [filteredTransactions, activeCurrencyCode, rates]
  )

  // Country breakdown
  const countryBreakdown = useMemo(
    () => groupByCountry(filteredTransactions, activeCurrencyCode, rates),
    [filteredTransactions, activeCurrencyCode, rates]
  )

  // Monthly chart — last 6 months (from all transactions, not filtered)
  const monthlyData = useMemo(() => {
    const last6Start = startOfMonth(subMonths(new Date(), 5))
    const sixMonthTx = transactions.filter(
      (t) => parseISO(t.date) >= last6Start
    )
    const grouped = groupByMonth(sixMonthTx, activeCurrencyCode, rates)
    // Build a complete 6-month array so empty months still show
    const months: { label: string; income: number; expenses: number; investments: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i)
      const key = format(d, "yyyy-MM")
      const shortLabel = format(d, "MMM", { locale: es })
        .replace(".", "")
        .slice(0, 3)
      const found = grouped.find((g) => g.month === key)
      months.push({
        label: shortLabel.charAt(0).toUpperCase() + shortLabel.slice(1),
        income: found?.income ?? 0,
        expenses: found?.expenses ?? 0,
        investments: found?.investments ?? 0,
      })
    }
    return months
  }, [transactions, activeCurrencyCode, rates])

  // Recent transactions — last 5 sorted by date
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
  }, [transactions])

  const hasTransactions = transactions.length > 0
  const multipleCountries = countryBreakdown.length > 1

  // All available countries
  const allCountries = countries.length > 0 ? countries : DEFAULT_COUNTRIES

  return (
    <div className="pb-8">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        className="px-4 pb-4 flex items-center justify-between"
        style={{ paddingTop: "max(3rem, env(safe-area-inset-top, 3rem))" }}
      >
        <div>
          <p className="text-xs text-muted-foreground font-medium tracking-widest uppercase mb-1">
            {format(new Date(), "EEEE d MMM", { locale: es })
              .replace(/^\w/, (c) => c.toUpperCase())}
          </p>
          <h1 className="text-2xl font-bold text-foreground leading-tight tracking-tight">
            {getGreeting(currentUser?.name)}
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Notification bell */}
          <button
            className="relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-95"
            style={{
              background: "color-mix(in oklch, var(--muted) 80%, transparent)",
              border: "1px solid color-mix(in oklch, var(--border) 50%, transparent)",
            }}
          >
            <Bell className="w-4 h-4 text-muted-foreground" />
            <span
              className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--expense)" }}
            />
          </button>

          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-bold text-white"
            style={{
              background:
                "linear-gradient(135deg, var(--app-accent), color-mix(in oklch, var(--app-accent) 70%, oklch(0.15 0.05 265)))",
              boxShadow:
                "0 2px 10px color-mix(in oklch, var(--app-accent) 40%, transparent)",
            }}
          >
            {getInitials(currentUser?.name)}
          </div>
        </div>
      </div>

      {/* ── Period selector ──────────────────────────────────────────────────── */}
      <div className="px-4 flex gap-2 mb-5">
        {(["month", "3months", "year"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
            style={
              period === p
                ? {
                    background: "var(--app-accent)",
                    color: "white",
                    boxShadow:
                      "0 2px 10px color-mix(in oklch, var(--app-accent) 40%, transparent)",
                  }
                : {
                    background:
                      "color-mix(in oklch, var(--muted) 70%, transparent)",
                    color: "var(--muted-foreground)",
                    border:
                      "1px solid color-mix(in oklch, var(--border) 40%, transparent)",
                  }
            }
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* ── Hero Balance Card ─────────────────────────────────────────────────── */}
      <div className="mx-4 mb-5 rounded-3xl overflow-hidden relative" style={{
        background: "linear-gradient(135deg, var(--app-accent), color-mix(in oklch, var(--app-accent) 65%, oklch(0.05 0.02 265)))",
        boxShadow: "0 8px 40px color-mix(in oklch, var(--app-accent) 35%, transparent)",
      }}>
        {/* Decorative dot pattern */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            opacity: 0.6,
          }}
        />
        {/* Decorative blobs */}
        <div
          className="absolute -top-8 -right-8 w-40 h-40 rounded-full blur-3xl"
          style={{ background: "oklch(0.98 0 0 / 12%)" }}
        />
        <div
          className="absolute -bottom-10 -left-6 w-36 h-36 rounded-full blur-3xl"
          style={{ background: "oklch(0.3 0.2 200 / 30%)" }}
        />

        {/* Content */}
        <div className="relative z-10 p-5">
          {/* Header row */}
          <div className="flex items-start justify-between mb-1">
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "oklch(0.98 0 0 / 65%)" }}
            >
              Balance neto
            </p>
            {totals.net !== 0 && (
              <div
                className="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{
                  background: "oklch(0 0 0 / 20%)",
                  color: "oklch(0.98 0 0)",
                }}
              >
                {totals.net > 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {totals.net > 0 ? "Positivo" : "Negativo"}
              </div>
            )}
          </div>

          {/* Big balance number */}
          <div className="mb-5">
            <p
              className="text-5xl font-black tracking-tight leading-none"
              style={{ color: "oklch(0.98 0 0)" }}
            >
              {formatMoney(totals.net, activeCurrency)}
            </p>
          </div>

          {/* Mini stats row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {/* Ingresos */}
            <div
              className="rounded-2xl px-3 py-2.5"
              style={{ background: "oklch(0 0 0 / 20%)" }}
            >
              <p
                className="text-xs mb-0.5 font-medium"
                style={{ color: "oklch(0.98 0 0 / 60%)" }}
              >
                Ingresos
              </p>
              <p
                className="text-sm font-bold leading-tight"
                style={{ color: "oklch(0.98 0 0)" }}
              >
                {formatMoney(totals.income, activeCurrency)}
              </p>
            </div>
            {/* Gastos */}
            <div
              className="rounded-2xl px-3 py-2.5"
              style={{ background: "oklch(0 0 0 / 20%)" }}
            >
              <p
                className="text-xs mb-0.5 font-medium"
                style={{ color: "oklch(0.98 0 0 / 60%)" }}
              >
                Gastos
              </p>
              <p
                className="text-sm font-bold leading-tight"
                style={{ color: "oklch(0.98 0 0)" }}
              >
                {formatMoney(totals.expenses, activeCurrency)}
              </p>
            </div>
            {/* Inversiones */}
            <div
              className="rounded-2xl px-3 py-2.5"
              style={{ background: "oklch(0 0 0 / 20%)" }}
            >
              <p
                className="text-xs mb-0.5 font-medium"
                style={{ color: "oklch(0.98 0 0 / 60%)" }}
              >
                Inversiones
              </p>
              <p
                className="text-sm font-bold leading-tight"
                style={{ color: "oklch(0.98 0 0)" }}
              >
                {formatMoney(totals.investments, activeCurrency)}
              </p>
            </div>
          </div>

          {/* Currency selector pills */}
          <div className="flex gap-1.5 flex-wrap">
            {allCurrencies.map((c) => (
              <button
                key={c.code}
                onClick={() =>
                  setDisplayCurrencyOverride(
                    c.code === activeCurrencyCode ? null : c.code
                  )
                }
                className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all active:scale-95"
                style={
                  c.code === activeCurrencyCode
                    ? {
                        background: "oklch(0.98 0 0)",
                        color: "var(--app-accent)",
                      }
                    : {
                        background: "oklch(0 0 0 / 25%)",
                        color: "oklch(0.98 0 0 / 70%)",
                        border: "1px solid oklch(0.98 0 0 / 15%)",
                      }
                }
              >
                {c.code}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Country breakdown ─────────────────────────────────────────────────── */}
      {multipleCountries && (
        <div className="px-4 mb-5">
          <h2 className="text-xs font-semibold text-muted-foreground mb-2.5 uppercase tracking-widest">
            Por país
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            {countryBreakdown.map(({ countryCode, income, expenses, investments }) => {
              const country =
                allCountries.find((c) => c.code === countryCode) ??
                DEFAULT_COUNTRIES.find((c) => c.code === countryCode)
              const net = income - expenses - investments
              return (
                <div
                  key={countryCode}
                  className="flex-shrink-0 rounded-2xl p-3.5 min-w-[140px]"
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{country?.flag ?? "🌎"}</span>
                    <span className="text-xs font-semibold text-foreground">
                      {country?.name ?? countryCode}
                    </span>
                  </div>
                  <p
                    className="text-base font-bold"
                    style={{ color: net >= 0 ? "var(--income)" : "var(--expense)" }}
                  >
                    {net >= 0 ? "+" : ""}
                    {formatMoney(net, activeCurrency)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatMoney(income, activeCurrency)} ingresado
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Monthly chart ─────────────────────────────────────────────────────── */}
      {hasTransactions && (
        <div className="px-4 mb-5">
          <div
            className="rounded-3xl p-4"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-foreground">
                Últimos 6 meses
              </h2>
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-sm" style={{ background: "var(--income)" }} />
                  Ingresos
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-sm" style={{ background: "var(--expense)" }} />
                  Gastos
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-sm" style={{ background: "var(--investment)" }} />
                  Inversiones
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={monthlyData}
                barCategoryGap="30%"
                barGap={2}
                margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              >
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "oklch(0.6 0.01 265)" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "oklch(0.6 0.01 265)" }}
                  tickFormatter={(v: number) =>
                    v === 0
                      ? "0"
                      : v >= 1000
                      ? `${(v / 1000).toFixed(0)}k`
                      : String(v)
                  }
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "oklch(0.5 0 0 / 6%)", radius: 6 }} />
                <Bar dataKey="income" fill="var(--income)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="var(--expense)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="investments" fill="var(--investment)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Recent transactions ───────────────────────────────────────────────── */}
      <div className="px-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground">
            Movimientos recientes
          </h2>
          {hasTransactions && (
            <Link
              href="/movimientos"
              className="flex items-center gap-0.5 text-xs font-semibold transition-opacity hover:opacity-70"
              style={{ color: "var(--app-accent)" }}
            >
              Ver todos
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {!hasTransactions ? (
          <EmptyState />
        ) : recentTransactions.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            <p className="text-sm text-muted-foreground">
              Sin movimientos en este período
            </p>
          </div>
        ) : (
          <div
            className="rounded-3xl overflow-hidden"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            {recentTransactions.map((tx, idx) => {
              const category = categories.find((c) => c.id === tx.categoryId)
              const txCurrency =
                allCurrencies.find((c) => c.code === tx.currencyCode) ??
                allCurrencies[0]
              const isLast = idx === recentTransactions.length - 1
              const dateStr = format(parseISO(tx.date), "d MMM", { locale: es })
                .replace(".", "")
              const amountStr = formatMoney(tx.amount, txCurrency)

              // Icon background color based on type or category
              const iconBgColor = category?.color
                ? `${category.color}22`
                : tx.type === "income"
                ? "color-mix(in oklch, var(--income) 12%, transparent)"
                : tx.type === "expense"
                ? "color-mix(in oklch, var(--expense) 12%, transparent)"
                : "color-mix(in oklch, var(--investment) 12%, transparent)"

              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-3.5 px-4"
                  style={{
                    height: "64px",
                    borderBottom: !isLast
                      ? "1px solid color-mix(in oklch, var(--border) 60%, transparent)"
                      : undefined,
                  }}
                >
                  {/* Icon circle */}
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: iconBgColor }}
                  >
                    {getTransactionIcon(tx.type)}
                  </div>

                  {/* Description + category */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight truncate">
                      {tx.description || category?.name || "Sin descripción"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {category?.name ?? tx.type} · {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0">
                    <p
                      className="text-sm font-bold tabular-nums"
                      style={{
                        color:
                          tx.type === "income"
                            ? "var(--income)"
                            : tx.type === "expense"
                            ? "var(--expense)"
                            : "var(--investment)",
                      }}
                    >
                      {tx.type === "income" ? "+" : tx.type === "expense" ? "−" : "~"}
                      {amountStr}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tx.currencyCode}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Quick actions ─────────────────────────────────────────────────────── */}
      <div className="px-4">
        <h2 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-widest">
          Acción rápida
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <Link
            href="/movimientos?new=true&type=expense"
            className="flex flex-col items-center gap-2.5 rounded-2xl py-4 px-3 transition-all active:scale-95"
            style={{
              background: "color-mix(in oklch, var(--expense) 10%, var(--card))",
              border: "1px solid color-mix(in oklch, var(--expense) 18%, var(--border))",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "var(--expense)",
                boxShadow: "0 2px 8px color-mix(in oklch, var(--expense) 40%, transparent)",
              }}
            >
              <TrendingDown className="w-4 h-4 text-white" />
            </div>
            <span
              className="text-xs font-semibold text-center leading-tight"
              style={{ color: "var(--expense)" }}
            >
              Nuevo gasto
            </span>
          </Link>

          <Link
            href="/movimientos?new=true&type=income"
            className="flex flex-col items-center gap-2.5 rounded-2xl py-4 px-3 transition-all active:scale-95"
            style={{
              background: "color-mix(in oklch, var(--income) 10%, var(--card))",
              border: "1px solid color-mix(in oklch, var(--income) 18%, var(--border))",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "var(--income)",
                boxShadow: "0 2px 8px color-mix(in oklch, var(--income) 40%, transparent)",
              }}
            >
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span
              className="text-xs font-semibold text-center leading-tight"
              style={{ color: "var(--income)" }}
            >
              Nuevo ingreso
            </span>
          </Link>

          <Link
            href="/movimientos?new=true&type=investment"
            className="flex flex-col items-center gap-2.5 rounded-2xl py-4 px-3 transition-all active:scale-95"
            style={{
              background: "color-mix(in oklch, var(--investment) 10%, var(--card))",
              border: "1px solid color-mix(in oklch, var(--investment) 18%, var(--border))",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "var(--investment)",
                boxShadow: "0 2px 8px color-mix(in oklch, var(--investment) 40%, transparent)",
              }}
            >
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <span
              className="text-xs font-semibold text-center leading-tight"
              style={{ color: "var(--investment)" }}
            >
              Nueva inversión
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
