"use client"

import { useState, useMemo } from "react"
import { useAnalysisStore } from "@/stores/analysis-store"
import type { SavedAnalysis } from "@/stores/analysis-store"
import Link from "next/link"
import {
  Brain,
  Camera,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowRight,
  Zap,
  LineChart,
  Lock,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  ChevronRight,
  PiggyBank,
  BarChart2,
  Lightbulb,
  Loader2,
  RefreshCw,
  History,
  Trash2,
  ChevronDown,
} from "lucide-react"
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfMonth as startOf,
  format,
  parseISO,
} from "date-fns"
import { es } from "date-fns/locale"

import { useTransactionsStore } from "@/stores/transactions-store"
import { useSettingsStore } from "@/stores/settings-store"
import { useRatesStore } from "@/stores/rates-store"
import { useCategoriesStore } from "@/stores/categories-store"
import {
  computeTotals,
  groupByMonth,
  groupByCategory,
  groupByCountry,
} from "@/lib/aggregations"
import { formatMoney } from "@/lib/money"
import { DEFAULT_CURRENCIES, DEFAULT_CATEGORIES } from "@/lib/types"
import type { InsightsData } from "@/app/api/ai/insights/route"

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "month" | "3months" | "all"

interface TransactionSummary {
  period: string
  totalIncome: number
  totalExpenses: number
  totalInvestments: number
  netBalance: number
  displayCurrency: string
  expensesByCategory: Record<string, number>
  incomeByCategory: Record<string, number>
  countriesActive: string[]
  currenciesUsed: string[]
  monthlyData: Array<{ month: string; income: number; expenses: number; investments: number }>
}

const PERIOD_LABELS: Record<Period, string> = {
  month: "Este mes",
  "3months": "3 meses",
  all: "Todo",
}

// ─── HealthScore ring ─────────────────────────────────────────────────────────

function HealthScoreRing({ score }: { score: number }) {
  const r = 44
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference

  const color =
    score >= 81
      ? "oklch(0.7 0.17 162)"
      : score >= 61
      ? "oklch(0.72 0.17 200)"
      : score >= 41
      ? "oklch(0.78 0.16 85)"
      : "oklch(0.65 0.22 15)"

  const label =
    score >= 81
      ? "Excelente"
      : score >= 61
      ? "Buena"
      : score >= 41
      ? "Regular"
      : "Crítica"

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg
          className="w-28 h-28 -rotate-90"
          viewBox="0 0 100 100"
        >
          {/* Track */}
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            strokeWidth="10"
            stroke="var(--muted)"
          />
          {/* Progress */}
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            strokeWidth="10"
            stroke={color}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-foreground leading-none">{score}</span>
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color }}>
            /100
          </span>
        </div>
      </div>
      <span
        className="text-xs font-bold px-3 py-1 rounded-full"
        style={{ background: `${color.replace("oklch(", "oklch(").replace(")", " / 0.12)")}`, color }}
      >
        {label}
      </span>
    </div>
  )
}

// ─── Alert card ───────────────────────────────────────────────────────────────

function AlertCard({
  alert,
}: {
  alert: InsightsData["alerts"][number]
}) {
  const severityConfig = {
    high: {
      bg: "color-mix(in oklch, oklch(0.65 0.22 15) 10%, var(--card))",
      border: "color-mix(in oklch, oklch(0.65 0.22 15) 30%, var(--border))",
      icon: <XCircle className="w-4 h-4" style={{ color: "oklch(0.65 0.22 15)" }} />,
      iconBg: "oklch(0.65 0.22 15 / 0.15)",
    },
    medium: {
      bg: "color-mix(in oklch, oklch(0.78 0.16 85) 10%, var(--card))",
      border: "color-mix(in oklch, oklch(0.78 0.16 85) 30%, var(--border))",
      icon: <AlertTriangle className="w-4 h-4" style={{ color: "oklch(0.6 0.16 85)" }} />,
      iconBg: "oklch(0.78 0.16 85 / 0.15)",
    },
    low: {
      bg: "color-mix(in oklch, oklch(0.7 0.17 162) 8%, var(--card))",
      border: "color-mix(in oklch, oklch(0.7 0.17 162) 25%, var(--border))",
      icon: <Info className="w-4 h-4" style={{ color: "oklch(0.55 0.17 162)" }} />,
      iconBg: "oklch(0.7 0.17 162 / 0.12)",
    },
  }

  const cfg = severityConfig[alert.severity]

  return (
    <div
      className="rounded-2xl p-3.5 flex items-start gap-3"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: cfg.iconBg }}
      >
        {cfg.icon}
      </div>
      <p className="text-sm text-foreground leading-relaxed">{alert.message}</p>
    </div>
  )
}

// ─── Observation card ─────────────────────────────────────────────────────────

function ObservationCard({
  obs,
}: {
  obs: InsightsData["observations"][number]
}) {
  const typeConfig = {
    positive: {
      icon: <CheckCircle2 className="w-4 h-4" />,
      color: "oklch(0.7 0.17 162)",
    },
    warning: {
      icon: <AlertTriangle className="w-4 h-4" />,
      color: "oklch(0.78 0.16 85)",
    },
    critical: {
      icon: <XCircle className="w-4 h-4" />,
      color: "oklch(0.65 0.22 15)",
    },
    info: {
      icon: <Info className="w-4 h-4" />,
      color: "oklch(0.65 0.18 264)",
    },
  }

  const categoryConfig = {
    income: { icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Ingresos" },
    expense: { icon: <TrendingDown className="w-3.5 h-3.5" />, label: "Gastos" },
    investment: { icon: <Wallet className="w-3.5 h-3.5" />, label: "Inversiones" },
    savings: { icon: <PiggyBank className="w-3.5 h-3.5" />, label: "Ahorro" },
    general: { icon: <BarChart2 className="w-3.5 h-3.5" />, label: "General" },
  }

  const tcfg = typeConfig[obs.type]
  const ccfg = categoryConfig[obs.category]

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${tcfg.color.replace("oklch(", "oklch(").replace(")", " / 0.12)")}`, color: tcfg.color }}
          >
            {tcfg.icon}
          </div>
          <p className="text-sm font-bold text-foreground leading-tight">{obs.title}</p>
        </div>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0"
          style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
        >
          {ccfg.icon}
          {ccfg.label}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed pl-9">
        {obs.description}
      </p>
    </div>
  )
}

// ─── Suggestion card ──────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  index,
}: {
  suggestion: InsightsData["suggestions"][number]
  index: number
}) {
  const priorityConfig = {
    high: {
      border: "oklch(0.65 0.22 15 / 0.4)",
      badge: { bg: "oklch(0.65 0.22 15 / 0.12)", color: "oklch(0.5 0.22 15)" },
      label: "Alta prioridad",
    },
    medium: {
      border: "oklch(0.78 0.16 85 / 0.4)",
      badge: { bg: "oklch(0.78 0.16 85 / 0.12)", color: "oklch(0.52 0.16 85)" },
      label: "Media prioridad",
    },
    low: {
      border: "oklch(0.7 0.17 162 / 0.3)",
      badge: { bg: "oklch(0.7 0.17 162 / 0.1)", color: "oklch(0.45 0.17 162)" },
      label: "Baja prioridad",
    },
  }

  const cfg = priorityConfig[suggestion.priority]

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "var(--card)",
        border: `1px solid var(--border)`,
        borderLeft: `3px solid ${cfg.border}`,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black"
            style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
          >
            {index + 1}
          </div>
          <p className="text-sm font-bold text-foreground">{suggestion.title}</p>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: cfg.badge.bg, color: cfg.badge.color }}
        >
          {cfg.label}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
        {suggestion.description}
      </p>
      <div
        className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
        style={{ background: "var(--muted)" }}
      >
        <Lightbulb className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-xs text-foreground font-medium leading-relaxed">
          {suggestion.actionable}
        </p>
      </div>
    </div>
  )
}

// ─── Feature card ─────────────────────────────────────────────────────────────

function FeatureCard({
  icon: Icon,
  iconBg,
  title,
  description,
  badge,
  disabled,
  href,
}: {
  icon: React.ElementType
  iconBg: string
  title: string
  description: string
  badge: string
  disabled?: boolean
  href?: string
}) {
  const button = (
    <button
      disabled={disabled}
      className="relative z-10 w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95"
      style={
        disabled
          ? { background: "var(--muted)", color: "var(--muted-foreground)", cursor: "not-allowed" }
          : { background: iconBg, color: "white" }
      }
    >
      {disabled ? (
        <>
          <Lock className="w-4 h-4" />
          Próximamente
        </>
      ) : (
        <>
          Ir al análisis
          <ArrowRight className="w-4 h-4" />
        </>
      )}
    </button>
  )

  return (
    <div
      className="rounded-3xl p-5 flex flex-col gap-4 relative overflow-hidden"
      style={{
        background: "var(--card)",
        border: disabled ? "1px solid var(--border)" : `1px solid color-mix(in oklch, ${iconBg} 30%, var(--border))`,
        opacity: disabled ? 0.85 : 1,
      }}
    >
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-20"
        style={{ background: iconBg }}
      />

      <div className="flex items-start justify-between relative z-10">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: `${iconBg}22` }}
        >
          <Icon className="w-6 h-6" style={{ color: iconBg }} />
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
          style={{
            background: disabled
              ? "color-mix(in oklch, var(--muted-foreground) 15%, var(--muted))"
              : `${iconBg}22`,
            color: disabled ? "var(--muted-foreground)" : iconBg,
          }}
        >
          {badge}
        </span>
      </div>

      <div className="relative z-10">
        <h3 className="text-base font-bold text-foreground mb-1.5">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>

      {href && !disabled ? (
        <Link href={href} className="relative z-10">
          {button}
        </Link>
      ) : (
        button
      )}
    </div>
  )
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function AnalysisSkeleton() {
  return (
    <div className="space-y-4">
      {/* Health score skeleton */}
      <div
        className="rounded-3xl p-6 flex flex-col items-center gap-4"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="w-28 h-28 rounded-full animate-pulse" style={{ background: "var(--muted)" }} />
        <div className="space-y-2 w-full">
          {[80, 60].map((w, i) => (
            <div
              key={i}
              className="h-3 rounded-full animate-pulse mx-auto"
              style={{ width: `${w}%`, background: "var(--muted)", animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Cards skeleton */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl p-4 space-y-2"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="h-4 rounded-full animate-pulse w-1/2" style={{ background: "var(--muted)", animationDelay: `${i * 80}ms` }} />
          <div className="h-3 rounded-full animate-pulse w-3/4" style={{ background: "var(--muted)", animationDelay: `${i * 80 + 40}ms` }} />
          <div className="h-3 rounded-full animate-pulse w-2/3" style={{ background: "var(--muted)", animationDelay: `${i * 80 + 80}ms` }} />
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalisisPage() {
  const [period, setPeriod] = useState<Period>("month")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isApiKeyError, setIsApiKeyError] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const { current: savedAnalysis, history: analysisHistory, saveAnalysis, removeFromHistory, clearHistory } = useAnalysisStore()
  const insights = savedAnalysis?.data ?? null

  const { transactions } = useTransactionsStore()
  const { displayCurrencyCode, currencies, countries } = useSettingsStore()
  const { rates } = useRatesStore()
  const { categories } = useCategoriesStore()

  const allCurrencies = currencies.length > 0 ? currencies : DEFAULT_CURRENCIES
  const displayCurrency =
    allCurrencies.find((c) => c.code === displayCurrencyCode) ?? allCurrencies[0]
  const allCategories = categories.length > 0 ? categories : DEFAULT_CATEGORIES

  const hasTransactions = transactions.length > 0

  // ── Filter transactions by period ────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    const now = new Date()
    if (period === "month") {
      const from = startOfMonth(now)
      const to = endOfMonth(now)
      return transactions.filter((t) => {
        const d = parseISO(t.date)
        return d >= from && d <= to
      })
    }
    if (period === "3months") {
      const from = startOf(subMonths(now, 2))
      const to = endOfMonth(now)
      return transactions.filter((t) => {
        const d = parseISO(t.date)
        return d >= from && d <= to
      })
    }
    return transactions
  }, [transactions, period])

  // ── Build TransactionSummary ──────────────────────────────────────────────
  const summary = useMemo((): TransactionSummary => {
    const totals = computeTotals(filteredTransactions, displayCurrencyCode, rates)

    // Expenses by category (name)
    const expensesByCategory: Record<string, number> = {}
    const expByCatRaw = groupByCategory(filteredTransactions, "expense", displayCurrencyCode, rates)
    expByCatRaw.forEach(({ categoryId, total }) => {
      const cat = allCategories.find((c) => c.id === categoryId)
      const name = cat?.name ?? categoryId
      expensesByCategory[name] = total
    })

    // Income by category (name)
    const incomeByCategory: Record<string, number> = {}
    const incByCatRaw = groupByCategory(filteredTransactions, "income", displayCurrencyCode, rates)
    incByCatRaw.forEach(({ categoryId, total }) => {
      const cat = allCategories.find((c) => c.id === categoryId)
      const name = cat?.name ?? categoryId
      incomeByCategory[name] = total
    })

    // Countries active
    const countriesActive = Array.from(
      new Set(filteredTransactions.map((t) => t.countryCode))
    )

    // Currencies used
    const currenciesUsed = Array.from(
      new Set(filteredTransactions.map((t) => t.currencyCode))
    )

    // Monthly data
    const monthlyRaw = groupByMonth(filteredTransactions, displayCurrencyCode, rates)
    const monthlyData = monthlyRaw.map((m) => ({
      month: m.label,
      income: m.income,
      expenses: m.expenses,
      investments: m.investments,
    }))

    const periodLabel =
      period === "month"
        ? `${format(new Date(), "MMMM yyyy", { locale: es })}`
        : period === "3months"
        ? "Últimos 3 meses"
        : "Todo el historial"

    return {
      period: periodLabel,
      totalIncome: totals.income,
      totalExpenses: totals.expenses,
      totalInvestments: totals.investments,
      netBalance: totals.net,
      displayCurrency: displayCurrencyCode,
      expensesByCategory,
      incomeByCategory,
      countriesActive,
      currenciesUsed,
      monthlyData,
    }
  }, [filteredTransactions, displayCurrencyCode, rates, allCategories, period])

  // ── Generate analysis ─────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setIsApiKeyError(false)

    try {
      const res = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(summary),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        const msg = json.error ?? "Error al generar el análisis."
        if (res.status === 503 || res.status === 401) setIsApiKeyError(true)
        setError(msg)
        return
      }

      // Save to persistent store — moves current to history automatically
      saveAnalysis(json.data as InsightsData, {
        totalIncome: summary.totalIncome,
        totalExpenses: summary.totalExpenses,
        totalInvestments: summary.totalInvestments,
        netBalance: summary.netBalance,
        displayCurrency: summary.displayCurrency,
        period: summary.period,
      })
    } catch {
      setError("No se pudo conectar con el servidor. Revisá tu conexión.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pb-24">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        className="px-4 pt-12 pb-8 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, color-mix(in oklch, #8b5cf6 10%, var(--background)), var(--background))",
        }}
      >
        <div
          className="absolute -top-10 -right-10 w-48 h-48 rounded-full blur-3xl opacity-15"
          style={{ background: "#8b5cf6" }}
        />
        <div
          className="absolute top-16 -left-10 w-32 h-32 rounded-full blur-3xl opacity-10"
          style={{ background: "#3b82f6" }}
        />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)" }}
            >
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">
                Inteligencia Artificial
              </p>
              <h1 className="text-2xl font-black text-foreground tracking-tight">
                Análisis IA
              </h1>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
            Dejá que la IA analice tus finanzas y te dé sugerencias personalizadas para
            mejorar tus hábitos de gasto.
          </p>
        </div>
      </div>

      {/* ── Feature cards ─────────────────────────────────────────────────── */}
      <div className="px-4 mb-6">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Funciones IA
        </h2>
        <div className="flex flex-col gap-4">
          <FeatureCard
            icon={Camera}
            iconBg="#8b5cf6"
            title="Escanear ticket"
            description="Fotografiá un ticket y la IA extraerá los datos automáticamente: monto, fecha, categoría y más."
            badge="Disponible"
            href="/escanear"
          />
          <FeatureCard
            icon={Brain}
            iconBg="#3b82f6"
            title="Análisis inteligente"
            description="Obtené sugerencias personalizadas sobre tus finanzas basadas en tus patrones de gasto."
            badge="Activo"
          />
        </div>
      </div>

      {/* ── Analysis section ──────────────────────────────────────────────── */}
      <div className="px-4 mb-6">
        <div
          className="rounded-3xl p-5 relative overflow-hidden"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-10"
            style={{ background: "#3b82f6" }}
          />

          {/* Title */}
          <div className="flex items-center gap-2 mb-4 relative z-10">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "#3b82f620" }}
            >
              <Sparkles className="w-4 h-4" style={{ color: "#3b82f6" }} />
            </div>
            <h2 className="text-sm font-bold text-foreground">Generar análisis financiero</h2>
          </div>

          {/* Period selector */}
          <div className="flex gap-2 mb-4 relative z-10">
            {(["month", "3months", "all"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
                style={
                  period === p
                    ? { background: "#3b82f6", color: "white" }
                    : { background: "var(--muted)", color: "var(--muted-foreground)" }
                }
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Quick stats preview */}
          {hasTransactions && (
            <div className="grid grid-cols-3 gap-2 mb-4 relative z-10">
              {[
                {
                  label: "Ingresos",
                  value: formatMoney(summary.totalIncome, displayCurrency),
                  color: "var(--income)",
                  icon: <TrendingUp className="w-3.5 h-3.5" />,
                },
                {
                  label: "Gastos",
                  value: formatMoney(summary.totalExpenses, displayCurrency),
                  color: "var(--expense)",
                  icon: <TrendingDown className="w-3.5 h-3.5" />,
                },
                {
                  label: "Inversiones",
                  value: formatMoney(summary.totalInvestments, displayCurrency),
                  color: "var(--investment)",
                  icon: <Wallet className="w-3.5 h-3.5" />,
                },
              ].map(({ label, value, color, icon }) => (
                <div
                  key={label}
                  className="rounded-2xl p-2.5"
                  style={{ background: "var(--muted)" }}
                >
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center mb-1.5"
                    style={{ background: `${color.replace("var(--", "").replace(")", "")}22`.includes("22") ? `color-mix(in oklch, ${color} 15%, transparent)` : `${color}22` }}
                  >
                    <span style={{ color }}>{icon}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className="text-xs font-bold text-foreground leading-tight">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Generate button */}
          {!hasTransactions ? (
            <div className="relative z-10 text-center py-4">
              <LineChart className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">
                Necesitás registrar movimientos para poder analizar.
              </p>
              <Link
                href="/movimientos?new=true&type=expense"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                style={{ background: "#3b82f6", color: "white" }}
              >
                Registrar movimiento
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="relative z-10 w-full h-14 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "white" }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analizando con Gemini...
                </>
              ) : insights ? (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Regenerar análisis
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generar análisis
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Loading state ─────────────────────────────────────────────────── */}
      {loading && (
        <div className="px-4 mb-6">
          <AnalysisSkeleton />
        </div>
      )}

      {/* ── Error state ───────────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="px-4 mb-6">
          <div
            className="rounded-3xl p-5"
            style={{
              background: isApiKeyError
                ? "color-mix(in oklch, #8b5cf6 8%, var(--card))"
                : "color-mix(in oklch, oklch(0.65 0.22 15) 8%, var(--card))",
              border: isApiKeyError
                ? "1px solid color-mix(in oklch, #8b5cf6 25%, var(--border))"
                : "1px solid color-mix(in oklch, oklch(0.65 0.22 15) 25%, var(--border))",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: isApiKeyError ? "#8b5cf622" : "oklch(0.65 0.22 15 / 0.15)",
                }}
              >
                <AlertTriangle
                  className="w-5 h-5"
                  style={{ color: isApiKeyError ? "#8b5cf6" : "oklch(0.65 0.22 15)" }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground mb-1">
                  {isApiKeyError ? "API Key no configurada" : "Error al analizar"}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">{error}</p>
                {isApiKeyError && (
                  <Link
                    href="/configuracion"
                    className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                    style={{ background: "#8b5cf6", color: "white" }}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Ir a Configuración
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {insights && !loading && (
        <div className="px-4 space-y-5">

          {/* Health Score */}
          <div
            className="rounded-3xl p-6 relative overflow-hidden"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div
              className="absolute -top-6 -right-6 w-28 h-28 rounded-full blur-2xl opacity-10"
              style={{ background: "#3b82f6" }}
            />

            <div className="flex flex-col items-center gap-4 relative z-10">
              <div className="flex items-center gap-2 self-start">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: "#3b82f620" }}
                >
                  <Zap className="w-4 h-4" style={{ color: "#3b82f6" }} />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Salud Financiera
                </p>
              </div>

              <HealthScoreRing score={insights.healthScore} />

              <p className="text-sm text-muted-foreground leading-relaxed text-center">
                {insights.summary}
              </p>
            </div>
          </div>

          {/* Savings opportunity */}
          {insights.savingsOpportunity !== undefined && insights.savingsOpportunity > 0 && (
            <div
              className="rounded-3xl p-4 flex items-center gap-3"
              style={{
                background: "color-mix(in oklch, oklch(0.7 0.17 162) 8%, var(--card))",
                border: "1px solid color-mix(in oklch, oklch(0.7 0.17 162) 25%, var(--border))",
              }}
            >
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "oklch(0.7 0.17 162 / 0.15)" }}
              >
                <PiggyBank className="w-5 h-5" style={{ color: "oklch(0.55 0.17 162)" }} />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-0.5">
                  Oportunidad de ahorro
                </p>
                <p className="text-base font-black text-foreground">
                  Podrías ahorrar hasta{" "}
                  <span style={{ color: "oklch(0.55 0.17 162)" }}>
                    {formatMoney(insights.savingsOpportunity, displayCurrency)}
                  </span>{" "}
                  por mes
                </p>
              </div>
            </div>
          )}

          {/* Alerts */}
          {insights.alerts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Alertas ({insights.alerts.length})
                </p>
              </div>
              <div className="space-y-2.5">
                {insights.alerts.map((alert, i) => (
                  <AlertCard key={i} alert={alert} />
                ))}
              </div>
            </div>
          )}

          {/* Observations */}
          {insights.observations.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Observaciones ({insights.observations.length})
                </p>
              </div>
              <div className="space-y-2.5">
                {insights.observations.map((obs, i) => (
                  <ObservationCard key={i} obs={obs} />
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {insights.suggestions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Sugerencias ({insights.suggestions.length})
                </p>
              </div>
              <div className="space-y-2.5">
                {insights.suggestions.map((s, i) => (
                  <SuggestionCard key={i} suggestion={s} index={i} />
                ))}
              </div>
            </div>
          )}

          {/* Timestamp */}
          {savedAnalysis && (
            <p className="text-center text-xs text-muted-foreground pb-2">
              Análisis generado el{" "}
              {new Intl.DateTimeFormat("es-AR", {
                dateStyle: "long",
                timeStyle: "short",
              }).format(new Date(savedAnalysis.generatedAt))}
            </p>
          )}
        </div>
      )}

      {/* ── Analysis History ──────────────────────────────────────────────── */}
      {analysisHistory.length > 0 && (
        <div className="px-4 mt-6">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="w-full flex items-center justify-between py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">
                Análisis anteriores
              </span>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: "color-mix(in oklch, var(--app-accent) 15%, var(--muted))",
                  color: "var(--app-accent)",
                }}
              >
                {analysisHistory.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); clearHistory() }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-lg"
              >
                Borrar todo
              </button>
              <ChevronDown
                className="w-4 h-4 text-muted-foreground transition-transform duration-200"
                style={{ transform: historyOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </div>
          </button>

          {historyOpen && (
            <div className="space-y-3 pb-4">
              {analysisHistory.map((item: SavedAnalysis) => (
                <HistoryCard
                  key={item.id}
                  item={item}
                  onRemove={() => removeFromHistory(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── History Card ─────────────────────────────────────────────────────────────

function HistoryCard({
  item,
  onRemove,
}: {
  item: SavedAnalysis
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const score = item.data.healthScore
  const scoreColor =
    score >= 81 ? "#10b981" : score >= 61 ? "#14b8a6" : score >= 41 ? "#f59e0b" : "#ef4444"

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        {/* Score badge */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-black"
          style={{ background: `${scoreColor}20`, color: scoreColor }}
        >
          {score}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {item.snapshot.period}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Intl.DateTimeFormat("es-AR", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(item.generatedAt))}
          </p>
        </div>

        {/* Mini stats */}
        <div className="text-right flex-shrink-0 hidden sm:block">
          <p className="text-xs text-muted-foreground">
            {item.snapshot.displayCurrency} {item.snapshot.netBalance.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <ChevronDown
            className="w-4 h-4 text-muted-foreground transition-transform duration-200"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div
          className="px-4 pb-4 space-y-3 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <p className="text-sm text-muted-foreground leading-relaxed pt-3">
            {item.data.summary}
          </p>

          {item.data.suggestions.slice(0, 2).map((s, i) => (
            <div
              key={i}
              className="rounded-xl p-3 text-xs"
              style={{
                background: "var(--muted)",
                borderLeft: `3px solid ${s.priority === "high" ? "#ef4444" : s.priority === "medium" ? "#f59e0b" : "#10b981"}`,
              }}
            >
              <p className="font-semibold text-foreground mb-0.5">{s.title}</p>
              <p className="text-muted-foreground">{s.actionable}</p>
            </div>
          ))}
          {item.data.suggestions.length > 2 && (
            <p className="text-xs text-muted-foreground text-center">
              +{item.data.suggestions.length - 2} sugerencias más
            </p>
          )}
        </div>
      )}
    </div>
  )
}
