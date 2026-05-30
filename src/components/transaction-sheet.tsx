"use client"

import * as React from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import * as LucideIcons from "lucide-react"
import {
  CalendarIcon,
  Loader2,
  Trash2,
  ChevronDown,
} from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

import { useTransactionsStore } from "@/stores/transactions-store"
import { useSettingsStore } from "@/stores/settings-store"
import { useCategoriesStore } from "@/stores/categories-store"

import type { Transaction, TransactionType } from "@/lib/types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryIcon(iconName: string) {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[iconName]
  return Icon ? <Icon className="w-5 h-5" /> : <LucideIcons.Circle className="w-5 h-5" />
}

const TYPE_CONFIG = {
  expense: {
    label: "Gasto",
    color: "var(--expense)",
    bg: "bg-[oklch(0.65_0.22_15/0.12)]",
    activeBg: "bg-[oklch(0.65_0.22_15)]",
    activeText: "text-white",
    border: "border-[oklch(0.65_0.22_15/0.3)]",
    title: "Nuevo gasto",
    placeholder: "¿En qué gastaste?",
  },
  income: {
    label: "Ingreso",
    color: "var(--income)",
    bg: "bg-[oklch(0.7_0.17_162/0.12)]",
    activeBg: "bg-[oklch(0.7_0.17_162)]",
    activeText: "text-white",
    border: "border-[oklch(0.7_0.17_162/0.3)]",
    title: "Nuevo ingreso",
    placeholder: "¿De dónde vino?",
  },
  investment: {
    label: "Inversión",
    color: "var(--investment)",
    bg: "bg-[oklch(0.65_0.18_264/0.12)]",
    activeBg: "bg-[oklch(0.65_0.18_264)]",
    activeText: "text-white",
    border: "border-[oklch(0.65_0.18_264/0.3)]",
    title: "Nueva inversión",
    placeholder: "¿En qué invertiste?",
  },
} as const

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  type: z.enum(["income", "expense", "investment"]),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  currencyCode: z.string().min(1),
  countryCode: z.string().min(1),
  categoryId: z.string().min(1, "Seleccioná una categoría"),
  description: z.string().min(1, "Agregá una descripción"),
  date: z.string(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TransactionPrefillValues {
  type?: TransactionType
  amount?: number
  currencyCode?: string
  countryCode?: string
  categoryId?: string
  description?: string
  date?: string
  notes?: string
  source?: "manual" | "ai-receipt"
}

interface TransactionSheetProps {
  open: boolean
  onClose: () => void
  transaction?: Transaction
  defaultType?: TransactionType
  prefillValues?: TransactionPrefillValues
}

// ─── Amount Input ─────────────────────────────────────────────────────────────

function AmountInput({
  value,
  onChange,
  currencySymbol,
  hasError,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  currencySymbol: string
  hasError?: boolean
}) {
  const [raw, setRaw] = React.useState(value ? String(value) : "")

  // Sync external value changes (e.g. reset)
  React.useEffect(() => {
    if (!value) setRaw("")
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    // Allow only digits and one decimal point
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setRaw(val)
      const num = parseFloat(val)
      onChange(isNaN(num) ? undefined : num)
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-3 rounded-2xl border-2 transition-all",
        "bg-muted/40",
        hasError ? "border-destructive/60" : "border-border focus-within:border-[var(--app-accent)]"
      )}
    >
      <span className="text-2xl font-light text-muted-foreground select-none">
        {currencySymbol}
      </span>
      <input
        inputMode="decimal"
        type="text"
        value={raw}
        onChange={handleChange}
        placeholder="0"
        className={cn(
          "flex-1 bg-transparent text-4xl font-bold tracking-tight outline-none",
          "text-foreground placeholder:text-muted-foreground/40",
          "w-full min-w-0"
        )}
      />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TransactionSheet({
  open,
  onClose,
  transaction,
  defaultType = "expense",
  prefillValues,
}: TransactionSheetProps) {
  const isEditing = Boolean(transaction)

  const { addTransaction, updateTransaction, removeTransaction } =
    useTransactionsStore()
  const { currencies, countries, displayCurrencyCode } = useSettingsStore()
  const { categories } = useCategoriesStore()

  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
  const [calendarOpen, setCalendarOpen] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: transaction?.type ?? prefillValues?.type ?? defaultType,
      amount: transaction?.amount ?? prefillValues?.amount,
      currencyCode: transaction?.currencyCode ?? prefillValues?.currencyCode ?? displayCurrencyCode,
      countryCode: transaction?.countryCode ?? prefillValues?.countryCode ?? countries[0]?.code ?? "",
      categoryId: transaction?.categoryId ?? prefillValues?.categoryId ?? "",
      description: transaction?.description ?? prefillValues?.description ?? "",
      date: transaction?.date ?? prefillValues?.date ?? new Date().toISOString().split("T")[0],
      notes: transaction?.notes ?? prefillValues?.notes ?? "",
    },
  })

  const selectedType = form.watch("type")
  const selectedCurrencyCode = form.watch("currencyCode")
  const selectedDate = form.watch("date")
  const typeConfig = TYPE_CONFIG[selectedType]

  // Filter categories for the current type
  const filteredCategories = React.useMemo(
    () =>
      categories.filter(
        (c) => c.type === selectedType || c.type === "all"
      ),
    [categories, selectedType]
  )

  // When type changes, reset category if it doesn't belong to new type
  React.useEffect(() => {
    const currentCategoryId = form.getValues("categoryId")
    const valid = filteredCategories.some((c) => c.id === currentCategoryId)
    if (!valid) form.setValue("categoryId", "")
  }, [selectedType, filteredCategories, form])

  // Reset form when opening
  React.useEffect(() => {
    if (open) {
      setShowDeleteConfirm(false)
      form.reset({
        type: transaction?.type ?? prefillValues?.type ?? defaultType,
        amount: transaction?.amount ?? prefillValues?.amount,
        currencyCode: transaction?.currencyCode ?? prefillValues?.currencyCode ?? displayCurrencyCode,
        countryCode: transaction?.countryCode ?? prefillValues?.countryCode ?? countries[0]?.code ?? "",
        categoryId: transaction?.categoryId ?? prefillValues?.categoryId ?? "",
        description: transaction?.description ?? prefillValues?.description ?? "",
        date: transaction?.date ?? prefillValues?.date ?? new Date().toISOString().split("T")[0],
        notes: transaction?.notes ?? prefillValues?.notes ?? "",
      })
    }
  }, [open, transaction, prefillValues, defaultType, displayCurrencyCode, countries, form])

  const selectedCurrency = currencies.find(
    (c) => c.code === selectedCurrencyCode
  )

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true)
    try {
      if (isEditing && transaction) {
        const result = updateTransaction(transaction.id, {
          ...values,
          amount: values.amount,
        })
        if (!result.success) {
          console.error("Error al actualizar movimiento:", result.error)
          return
        }
      } else {
        const result = addTransaction({
          ...values,
          amount: values.amount,
          source: prefillValues?.source ?? "manual",
        })
        if (!result.success) {
          console.error("Error al agregar movimiento:", result.error)
          return
        }
      }
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleDelete() {
    if (!transaction) return
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true)
      return
    }
    removeTransaction(transaction.id)
    onClose()
  }

  const title = isEditing
    ? "Editar movimiento"
    : typeConfig.title

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="p-0 rounded-t-3xl max-h-[95dvh] flex flex-col overflow-hidden gap-0"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Scrollable form body */}
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5">
            {/* Header: Title + Type Tabs */}
            <SheetHeader className="p-0 pt-1">
              <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
            </SheetHeader>

            {/* Type selector */}
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <div className="flex gap-2 p-1 rounded-xl bg-muted">
                  {(["expense", "income", "investment"] as TransactionType[]).map(
                    (t) => {
                      const cfg = TYPE_CONFIG[t]
                      const isActive = field.value === t
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => field.onChange(t)}
                          className={cn(
                            "flex-1 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
                            isActive
                              ? `${cfg.activeBg} ${cfg.activeText} shadow-sm`
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {cfg.label}
                        </button>
                      )
                    }
                  )}
                </div>
              )}
            />

            {/* Amount + Currency Row */}
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                {/* Currency select */}
                <Controller
                  control={form.control}
                  name="currencyCode"
                  render={({ field }) => {
                    const cur = currencies.find((c) => c.code === field.value)
                    return (
                      <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                        <SelectTrigger className="w-auto shrink-0 h-9 rounded-xl border-border bg-muted/40 text-sm font-medium gap-1.5">
                          <span className="flex items-center gap-1">
                            <span className="font-bold text-base leading-none" style={{ color: "var(--app-accent)" }}>{cur?.symbol}</span>
                            <span className="font-mono text-xs font-semibold">{field.value}</span>
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {currencies.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              <span className="flex items-center gap-2">
                                <span className="font-bold w-5 text-right" style={{ color: "var(--app-accent)" }}>{c.symbol}</span>
                                <span className="font-mono text-xs font-semibold">{c.code}</span>
                                <span className="text-muted-foreground text-xs">{c.name}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )
                  }}
                />

                {/* Country select */}
                <Controller
                  control={form.control}
                  name="countryCode"
                  render={({ field }) => {
                    const cntry = countries.find((c) => c.code === field.value)
                    return (
                      <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                        <SelectTrigger className="w-auto shrink-0 h-9 rounded-xl border-border bg-muted/40 text-sm gap-1.5">
                          <span className="flex items-center gap-1">
                            <span className="text-base leading-none">{cntry?.flag}</span>
                            <span className="font-medium text-xs">{field.value}</span>
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {countries.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              <span className="flex items-center gap-2">
                                <span className="text-base">{c.flag}</span>
                                <span className="font-medium">{c.name}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )
                  }}
                />
              </div>

              {/* Amount input */}
              <Controller
                control={form.control}
                name="amount"
                render={({ field, fieldState }) => (
                  <div>
                    <AmountInput
                      value={field.value}
                      onChange={(v) => field.onChange(v)}
                      currencySymbol={selectedCurrency?.symbol ?? "$"}
                      hasError={Boolean(fieldState.error)}
                    />
                    {fieldState.error && (
                      <p className="text-xs text-destructive mt-1 px-1">
                        {fieldState.error.message}
                      </p>
                    )}
                  </div>
                )}
              />
            </div>

            {/* Category picker */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-0.5">
                Categoría
              </label>
              <Controller
                control={form.control}
                name="categoryId"
                render={({ field, fieldState }) => (
                  <div>
                    <div className="grid grid-cols-4 gap-2">
                      {filteredCategories.map((cat) => {
                        const isSelected = field.value === cat.id
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => field.onChange(cat.id)}
                            className={cn(
                              "flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-150",
                              isSelected
                                ? "scale-95"
                                : "opacity-70 hover:opacity-100 hover:scale-105"
                            )}
                          >
                            <div
                              className={cn(
                                "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                                isSelected
                                  ? "shadow-lg ring-2 ring-offset-2 ring-offset-background"
                                  : ""
                              )}
                              style={{
                                backgroundColor: `${cat.color}22`,
                                color: cat.color,
                                ...(isSelected
                                  ? {
                                      backgroundColor: cat.color,
                                      color: "white",
                                      ringColor: cat.color,
                                    }
                                  : {}),
                              }}
                            >
                              {getCategoryIcon(cat.icon)}
                            </div>
                            <span
                              className={cn(
                                "text-[10px] leading-tight text-center font-medium line-clamp-2",
                                isSelected
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                              )}
                            >
                              {cat.name}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    {fieldState.error && (
                      <p className="text-xs text-destructive mt-1 px-1">
                        {fieldState.error.message}
                      </p>
                    )}
                  </div>
                )}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-0.5">
                Descripción
              </label>
              <Controller
                control={form.control}
                name="description"
                render={({ field, fieldState }) => (
                  <div>
                    <Input
                      {...field}
                      placeholder={typeConfig.placeholder}
                      className="h-10 rounded-xl bg-muted/40 border-border"
                    />
                    {fieldState.error && (
                      <p className="text-xs text-destructive mt-1 px-1">
                        {fieldState.error.message}
                      </p>
                    )}
                  </div>
                )}
              />
            </div>

            {/* Date picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-0.5">
                Fecha
              </label>
              <Controller
                control={form.control}
                name="date"
                render={({ field }) => (
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger
                      className={cn(
                        "w-full h-10 rounded-xl border border-input bg-muted/40",
                        "flex items-center justify-between px-3 text-sm",
                        "hover:bg-muted transition-colors"
                      )}
                    >
                      <span className="text-foreground">
                        {field.value
                          ? format(new Date(field.value + "T12:00:00"), "PPP", {
                              locale: es,
                            })
                          : "Elegí una fecha"}
                      </span>
                      <CalendarIcon className="size-4 text-muted-foreground" />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" side="top">
                      <Calendar
                        mode="single"
                        selected={
                          field.value
                            ? new Date(field.value + "T12:00:00")
                            : undefined
                        }
                        onSelect={(date) => {
                          if (date) {
                            field.onChange(
                              date.toISOString().split("T")[0]
                            )
                          }
                          setCalendarOpen(false)
                        }}
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-0.5">
                Notas <span className="normal-case font-normal">(opcional)</span>
              </label>
              <Controller
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <Textarea
                    {...field}
                    placeholder="Agregá detalles adicionales..."
                    rows={2}
                    className="rounded-xl bg-muted/40 border-border resize-none text-sm"
                  />
                )}
              />
            </div>

            {/* Delete section (editing only) */}
            {isEditing && (
              <div className="pt-1">
                {showDeleteConfirm ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      className="flex-1 h-10 rounded-xl"
                      onClick={handleDelete}
                    >
                      Confirmar eliminación
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-xl px-4"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full h-10 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={handleDelete}
                  >
                    <Trash2 className="size-4 mr-2" />
                    Eliminar movimiento
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Sticky footer with submit */}
          <div className="shrink-0 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] border-t border-border bg-popover">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 rounded-2xl text-base font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
