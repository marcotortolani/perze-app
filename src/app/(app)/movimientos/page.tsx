"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { format, isToday, isYesterday, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import * as LucideIcons from "lucide-react"
import {
  SlidersHorizontal,
  Plus,
  X,
  Search,
  MoreVertical,
  Trash2,
  ChevronDown,
  Receipt,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import { useTransactionsStore } from "@/stores/transactions-store"
import { useSettingsStore } from "@/stores/settings-store"
import { useCategoriesStore } from "@/stores/categories-store"

import { filterTransactions, type TransactionFilters } from "@/lib/aggregations"
import { formatMoney } from "@/lib/money"
import type { Transaction, TransactionType } from "@/lib/types"
import { TransactionSheet } from "@/components/transaction-sheet"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryIcon(iconName: string) {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[iconName]
  return Icon ? <Icon className="w-4 h-4" /> : <LucideIcons.Circle className="w-4 h-4" />
}

/** Format date as "Hoy", "Ayer", "Lunes 28 de mayo", or "28/05/2025" */
function formatDateLabel(dateStr: string): string {
  const date = parseISO(dateStr + "T12:00:00")
  if (isToday(date)) return "Hoy"
  if (isYesterday(date)) return "Ayer"

  const now = new Date()
  const diffDays = Math.abs(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diffDays <= 7) {
    // "Lunes 28 de mayo"
    const label = format(date, "EEEE d 'de' MMMM", { locale: es })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }

  return format(date, "dd/MM/yyyy")
}

/** Group transactions by date string */
function groupByDate(
  transactions: Transaction[]
): Array<{ date: string; label: string; items: Transaction[] }> {
  const map = new Map<string, Transaction[]>()

  // Sort descending first
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  for (const t of sorted) {
    const key = t.date.split("T")[0]
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  }

  return Array.from(map.entries()).map(([date, items]) => ({
    date,
    label: formatDateLabel(date),
    items,
  }))
}

const TYPE_LABELS: Record<TransactionType | "all", string> = {
  all: "Todos",
  expense: "Gastos",
  income: "Ingresos",
  investment: "Inversiones",
}

const TYPE_COLORS: Record<TransactionType, string> = {
  expense: "text-[oklch(0.65_0.22_15)]",
  income: "text-[oklch(0.7_0.17_162)]",
  investment: "text-[oklch(0.65_0.18_264)]",
}

const TYPE_BG: Record<TransactionType, string> = {
  expense: "bg-[oklch(0.65_0.22_15/0.12)]",
  income: "bg-[oklch(0.7_0.17_162/0.12)]",
  investment: "bg-[oklch(0.65_0.18_264/0.12)]",
}

// ─── Filter Sheet ─────────────────────────────────────────────────────────────

interface FilterSheetProps {
  open: boolean
  onClose: () => void
  filters: TransactionFilters
  onApply: (f: TransactionFilters) => void
}

function FilterSheet({ open, onClose, filters, onApply }: FilterSheetProps) {
  const { currencies, countries } = useSettingsStore()
  const { categories } = useCategoriesStore()
  const [local, setLocal] = React.useState<TransactionFilters>(filters)

  React.useEffect(() => {
    if (open) setLocal(filters)
  }, [open, filters])

  function update<K extends keyof TransactionFilters>(
    key: K,
    value: TransactionFilters[K]
  ) {
    setLocal((prev) => ({ ...prev, [key]: value }))
  }

  const [fromOpen, setFromOpen] = React.useState(false)
  const [toOpen, setToOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="p-0 rounded-t-3xl max-h-[90dvh] flex flex-col overflow-hidden gap-0"
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="flex-1 overflow-y-auto">
          <SheetHeader className="px-4 pt-2 pb-4">
            <SheetTitle className="text-base font-semibold">Filtros</SheetTitle>
          </SheetHeader>

          <div className="px-4 space-y-5 pb-4">
            {/* Search */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={local.search ?? ""}
                  onChange={(e) => update("search", e.target.value || undefined)}
                  placeholder="Descripción, notas..."
                  className="pl-9 h-10 rounded-xl bg-muted/40 border-border"
                />
              </div>
            </div>

            {/* Country */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                País
              </label>
              <Select
                value={local.countryCode ?? ""}
                onValueChange={(v) => update("countryCode", v || undefined)}
              >
                <SelectTrigger className="w-full h-10 rounded-xl bg-muted/40 border-border">
                  <span className="flex items-center gap-2 text-sm">
                    {local.countryCode
                      ? <>{countries.find(c => c.code === local.countryCode)?.flag} {countries.find(c => c.code === local.countryCode)?.name}</>
                      : <span className="text-muted-foreground">Todos</span>}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los países</SelectItem>
                  {countries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Currency */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Moneda
              </label>
              <Select
                value={local.currencyCode ?? ""}
                onValueChange={(v) => update("currencyCode", v || undefined)}
              >
                <SelectTrigger className="w-full h-10 rounded-xl bg-muted/40 border-border">
                  <span className="flex items-center gap-2 text-sm">
                    {local.currencyCode
                      ? <><span className="font-semibold">{currencies.find(c => c.code === local.currencyCode)?.symbol}</span> {local.currencyCode}</>
                      : <span className="text-muted-foreground">Todos</span>}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas las monedas</SelectItem>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="font-semibold">{c.symbol}</span> {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Categoría
              </label>
              <Select
                value={local.categoryId ?? ""}
                onValueChange={(v) => update("categoryId", v || undefined)}
              >
                <SelectTrigger className="w-full h-10 rounded-xl bg-muted/40 border-border">
                  <span className="text-sm">
                    {local.categoryId
                      ? categories.find(c => c.id === local.categoryId)?.name
                      : <span className="text-muted-foreground">Todos</span>}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas las categorías</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Rango de fechas
              </label>
              <div className="flex gap-2">
                <Popover open={fromOpen} onOpenChange={setFromOpen}>
                  <PopoverTrigger
                    className={cn(
                      "flex-1 h-10 rounded-xl border border-input bg-muted/40",
                      "flex items-center justify-between px-3 text-sm",
                      "hover:bg-muted transition-colors"
                    )}
                  >
                    <span className={local.dateFrom ? "text-foreground" : "text-muted-foreground"}>
                      {local.dateFrom
                        ? format(parseISO(local.dateFrom + "T12:00:00"), "dd/MM/yy")
                        : "Desde"}
                    </span>
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" side="top">
                    <Calendar
                      mode="single"
                      selected={
                        local.dateFrom
                          ? parseISO(local.dateFrom + "T12:00:00")
                          : undefined
                      }
                      onSelect={(d) => {
                        update("dateFrom", d ? d.toISOString().split("T")[0] : undefined)
                        setFromOpen(false)
                      }}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>

                <Popover open={toOpen} onOpenChange={setToOpen}>
                  <PopoverTrigger
                    className={cn(
                      "flex-1 h-10 rounded-xl border border-input bg-muted/40",
                      "flex items-center justify-between px-3 text-sm",
                      "hover:bg-muted transition-colors"
                    )}
                  >
                    <span className={local.dateTo ? "text-foreground" : "text-muted-foreground"}>
                      {local.dateTo
                        ? format(parseISO(local.dateTo + "T12:00:00"), "dd/MM/yy")
                        : "Hasta"}
                    </span>
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" side="top">
                    <Calendar
                      mode="single"
                      selected={
                        local.dateTo
                          ? parseISO(local.dateTo + "T12:00:00")
                          : undefined
                      }
                      onSelect={(d) => {
                        update("dateTo", d ? d.toISOString().split("T")[0] : undefined)
                        setToOpen(false)
                      }}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] border-t border-border bg-popover flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-11 rounded-2xl"
            onClick={() => {
              setLocal({})
              onApply({})
              onClose()
            }}
          >
            Limpiar
          </Button>
          <Button
            type="button"
            className="flex-1 h-11 rounded-2xl font-semibold"
            onClick={() => {
              onApply(local)
              onClose()
            }}
          >
            Aplicar filtros
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Transaction Item ─────────────────────────────────────────────────────────

function TransactionItem({
  transaction,
  onEdit,
  onDelete,
}: {
  transaction: Transaction
  onEdit: () => void
  onDelete: () => void
}) {
  const { currencies } = useSettingsStore()
  const { categories } = useCategoriesStore()
  const { countries } = useSettingsStore()

  const category = categories.find((c) => c.id === transaction.categoryId)
  const currency = currencies.find((c) => c.code === transaction.currencyCode)
  const country = countries.find((c) => c.code === transaction.countryCode)

  const sign = transaction.type === "expense" ? "-" : "+"
  const amountStr = currency
    ? formatMoney(transaction.amount, currency)
    : `${transaction.amount}`

  const [menuOpen, setMenuOpen] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-2xl bg-card/60 border border-border/50",
        "active:scale-[0.99] transition-transform duration-100"
      )}
    >
      {/* Category icon */}
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0"
      >
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{
            backgroundColor: category ? `${category.color}22` : "#6b728022",
            color: category?.color ?? "#6b7280",
          }}
        >
          {category ? getCategoryIcon(category.icon) : <LucideIcons.Circle className="w-4 h-4" />}
        </div>
      </button>

      {/* Info */}
      <button
        type="button"
        onClick={onEdit}
        className="flex-1 min-w-0 text-left"
      >
        <p className="text-sm font-semibold text-foreground truncate leading-tight">
          {transaction.description}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] text-muted-foreground">
            {category?.name ?? "Sin categoría"}
          </span>
          {country && (
            <>
              <span className="text-muted-foreground/40 text-[10px]">·</span>
              <span className="text-[11px] text-muted-foreground">
                {country.flag} {transaction.currencyCode}
              </span>
            </>
          )}
        </div>
      </button>

      {/* Amount + menu */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className={cn(
            "text-sm font-bold tabular-nums",
            TYPE_COLORS[transaction.type]
          )}
        >
          {sign}{amountStr}
        </span>

        {/* Context menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setMenuOpen((v) => !v)
              setConfirmDelete(false)
            }}
            className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <MoreVertical className="size-4" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => {
                  setMenuOpen(false)
                  setConfirmDelete(false)
                }}
              />
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-xl bg-popover border border-border shadow-lg overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors"
                  onClick={() => {
                    setMenuOpen(false)
                    onEdit()
                  }}
                >
                  <LucideIcons.Pencil className="size-3.5 text-muted-foreground" />
                  Editar
                </button>
                {!confirmDelete ? (
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="size-3.5" />
                    Eliminar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors"
                    onClick={() => {
                      setMenuOpen(false)
                      onDelete()
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    ¿Confirmar?
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  hasFilters,
  onAdd,
}: {
  hasFilters: boolean
  onAdd: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mb-5">
        <Receipt className="size-9 text-muted-foreground/50" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1.5">
        {hasFilters ? "Sin resultados" : "No hay movimientos"}
      </h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-[240px]">
        {hasFilters
          ? "Probá ajustando o limpiando los filtros para ver más resultados."
          : "Registrá tus gastos, ingresos e inversiones para llevar el control de tus finanzas."}
      </p>
      {!hasFilters && (
        <Button
          onClick={onAdd}
          className="h-10 px-6 rounded-xl font-semibold gap-2"
        >
          <Plus className="size-4" />
          Agregar movimiento
        </Button>
      )}
    </div>
  )
}

// ─── Filter Chips ─────────────────────────────────────────────────────────────

function FilterChips({
  filters,
  onChange,
}: {
  filters: TransactionFilters
  onChange: (f: TransactionFilters) => void
}) {
  const { currencies, countries } = useSettingsStore()
  const { categories } = useCategoriesStore()

  const chips: Array<{ key: keyof TransactionFilters; label: string }> = []

  if (filters.type)
    chips.push({ key: "type", label: TYPE_LABELS[filters.type] })
  if (filters.countryCode) {
    const country = countries.find((c) => c.code === filters.countryCode)
    chips.push({ key: "countryCode", label: `${country?.flag ?? ""} ${country?.name ?? filters.countryCode}` })
  }
  if (filters.currencyCode)
    chips.push({ key: "currencyCode", label: filters.currencyCode })
  if (filters.categoryId) {
    const cat = categories.find((c) => c.id === filters.categoryId)
    chips.push({ key: "categoryId", label: cat?.name ?? filters.categoryId })
  }
  if (filters.dateFrom)
    chips.push({ key: "dateFrom", label: `Desde ${filters.dateFrom}` })
  if (filters.dateTo)
    chips.push({ key: "dateTo", label: `Hasta ${filters.dateTo}` })
  if (filters.search)
    chips.push({ key: "search", label: `"${filters.search}"` })

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 px-4 pb-2">
      {chips.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => {
            const updated = { ...filters }
            delete updated[key]
            onChange(updated)
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs font-medium text-foreground border border-border hover:bg-muted/70 transition-colors"
        >
          {label}
          <X className="size-3 text-muted-foreground" />
        </button>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MovimientosPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const { transactions, removeTransaction } = useTransactionsStore()

  // URL param: auto-open sheet if ?new=true
  const shouldOpenNew = searchParams.get("new") === "true"
  const urlType = searchParams.get("type") as TransactionType | null

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingTransaction, setEditingTransaction] = React.useState<
    Transaction | undefined
  >(undefined)
  const [defaultSheetType, setDefaultSheetType] =
    React.useState<TransactionType>("expense")
  const [filterOpen, setFilterOpen] = React.useState(false)
  const [filters, setFilters] = React.useState<TransactionFilters>({})

  // Handle URL params on mount
  React.useEffect(() => {
    if (shouldOpenNew) {
      setDefaultSheetType(
        urlType && ["expense", "income", "investment"].includes(urlType)
          ? urlType
          : "expense"
      )
      setEditingTransaction(undefined)
      setSheetOpen(true)
      // Clean up URL
      router.replace("/movimientos", { scroll: false })
    }
  }, [shouldOpenNew, urlType, router])

  function openNew(type: TransactionType = "expense") {
    setEditingTransaction(undefined)
    setDefaultSheetType(type)
    setSheetOpen(true)
  }

  function openEdit(transaction: Transaction) {
    setEditingTransaction(transaction)
    setSheetOpen(true)
  }

  function handleSheetClose() {
    setSheetOpen(false)
    setEditingTransaction(undefined)
  }

  // Filter + sort
  const filtered = React.useMemo(
    () => filterTransactions(transactions, filters),
    [transactions, filters]
  )

  const grouped = React.useMemo(() => groupByDate(filtered), [filtered])

  const hasActiveFilters = Object.keys(filters).some(
    (k) => filters[k as keyof TransactionFilters] !== undefined
  )

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center justify-between px-4 pt-12 pb-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Movimientos
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filtered.length}{" "}
              {filtered.length === 1 ? "movimiento" : "movimientos"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className={cn(
              "relative flex items-center justify-center w-10 h-10 rounded-xl border transition-colors",
              hasActiveFilters
                ? "bg-foreground text-background border-foreground"
                : "bg-muted border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <SlidersHorizontal className="size-4.5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-[var(--app-accent)] text-white text-[9px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Active filter chips */}
        <FilterChips filters={filters} onChange={setFilters} />

        {/* Quick type filter */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {(["all", "expense", "income", "investment"] as (TransactionType | "all")[]).map((t) => {
            const active = (t === "all" && !filters.type) || filters.type === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setFilters({ ...filters, type: t === "all" ? undefined : t })}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
                style={active ? {
                  background: t === "all" ? "var(--foreground)" : t === "expense" ? "var(--expense)" : t === "income" ? "var(--income)" : "var(--investment)",
                  color: t === "all" ? "var(--background)" : "var(--app-accent-foreground)",
                } : {
                  background: "var(--muted)",
                  color: "var(--muted-foreground)",
                  border: "1px solid var(--border)",
                }}
              >
                {TYPE_LABELS[t]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pt-1 pb-4 space-y-4">
        {grouped.length === 0 ? (
          <EmptyState hasFilters={hasActiveFilters} onAdd={() => openNew()} />
        ) : (
          grouped.map(({ date, label, items }) => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {label}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Transaction list */}
              <div className="space-y-2">
                {items.map((t) => (
                  <TransactionItem
                    key={t.id}
                    transaction={t}
                    onEdit={() => openEdit(t)}
                    onDelete={() => removeTransaction(t.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Transaction Sheet */}
      <TransactionSheet
        open={sheetOpen}
        onClose={handleSheetClose}
        transaction={editingTransaction}
        defaultType={defaultSheetType}
      />

      {/* Filter Sheet */}
      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onApply={setFilters}
      />
    </div>
  )
}
