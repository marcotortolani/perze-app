"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  User,
  Palette,
  DollarSign,
  RefreshCw,
  Globe,
  LogOut,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  AlertCircle,
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"

import { useSettingsStore } from "@/stores/settings-store"
import { useRatesStore } from "@/stores/rates-store"
import { useAuthStore } from "@/stores/auth-store"
import { useTransactionsStore } from "@/stores/transactions-store"
import {
  type AccentColor,
  type Theme,
  type Currency,
  type Country,
  DEFAULT_CURRENCIES,
} from "@/lib/types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT_COLORS: { value: AccentColor; label: string; hex: string }[] = [
  { value: "emerald", label: "Esmeralda", hex: "#10b981" },
  { value: "violet", label: "Violeta", hex: "#8b5cf6" },
  { value: "blue", label: "Azul", hex: "#3b82f6" },
  { value: "rose", label: "Rosa", hex: "#f43f5e" },
  { value: "amber", label: "Ámbar", hex: "#f59e0b" },
]

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "system", label: "Sistema", icon: Monitor },
  { value: "dark", label: "Oscuro", icon: Moon },
]

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 px-4">
        <div
          className="w-7 h-7 rounded-xl flex items-center justify-center"
          style={{ background: "color-mix(in oklch, var(--app-accent) 15%, var(--muted))" }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: "var(--app-accent)" }} />
        </div>
        <h2 className="text-sm font-bold text-foreground tracking-tight">{title}</h2>
      </div>
      <div
        className="mx-4 rounded-3xl overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        {children}
      </div>
    </div>
  )
}

function Row({
  children,
  last,
}: {
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      className="px-4 py-3.5"
      style={!last ? { borderBottom: "1px solid var(--border)" } : undefined}
    >
      {children}
    </div>
  )
}

// ─── Dialogs ──────────────────────────────────────────────────────────────────

function AddCurrencyDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { addCurrency } = useSettingsStore()
  const { setRate } = useRatesStore()
  const [form, setForm] = useState({ code: "", name: "", symbol: "", decimals: "2" })

  function handleSubmit() {
    if (!form.code.trim() || !form.name.trim() || !form.symbol.trim()) {
      toast.error("Completá todos los campos obligatorios")
      return
    }
    const currency: Currency = {
      code: form.code.toUpperCase().trim(),
      name: form.name.trim(),
      symbol: form.symbol.trim(),
      decimals: parseInt(form.decimals) || 2,
    }
    addCurrency(currency)
    setRate(currency.code, 1) // default rate
    toast.success(`Moneda ${currency.code} agregada`)
    setForm({ code: "", name: "", symbol: "", decimals: "2" })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 rounded-3xl">
        <DialogHeader>
          <DialogTitle>Agregar moneda</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              Código ISO (ej: BRL)
            </Label>
            <Input
              placeholder="USD"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              maxLength={4}
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              Nombre
            </Label>
            <Input
              placeholder="Dólar estadounidense"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Símbolo
              </Label>
              <Input
                placeholder="$"
                value={form.symbol}
                onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
                maxLength={5}
              />
            </div>
            <div className="w-24">
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Decimales
              </Label>
              <Select
                value={form.decimals}
                onValueChange={(v) => setForm((f) => ({ ...f, decimals: v ?? f.decimals }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-row gap-2 mt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            style={{ background: "var(--app-accent)", color: "var(--app-accent-foreground)" }}
            onClick={handleSubmit}
          >
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddCountryDialog({
  open,
  onOpenChange,
  currencies,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  currencies: Currency[]
}) {
  const { addCountry } = useSettingsStore()
  const [form, setForm] = useState({
    code: "",
    name: "",
    flag: "",
    currencyCodes: [] as string[],
  })

  function toggleCurrency(code: string) {
    setForm((f) => ({
      ...f,
      currencyCodes: f.currencyCodes.includes(code)
        ? f.currencyCodes.filter((c) => c !== code)
        : [...f.currencyCodes, code],
    }))
  }

  function handleSubmit() {
    if (!form.code.trim() || !form.name.trim() || !form.flag.trim()) {
      toast.error("Completá todos los campos obligatorios")
      return
    }
    const country: Country = {
      code: form.code.toUpperCase().trim(),
      name: form.name.trim(),
      flag: form.flag.trim(),
      currencyCodes: form.currencyCodes,
    }
    addCountry(country)
    toast.success(`País ${country.name} agregado`)
    setForm({ code: "", name: "", flag: "", currencyCodes: [] })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 rounded-3xl">
        <DialogHeader>
          <DialogTitle>Agregar país</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Código (ej: BR)
              </Label>
              <Input
                placeholder="AR"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                maxLength={3}
              />
            </div>
            <div className="w-24">
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Bandera emoji
              </Label>
              <Input
                placeholder="🇧🇷"
                value={form.flag}
                onChange={(e) => setForm((f) => ({ ...f, flag: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              Nombre del país
            </Label>
            <Input
              placeholder="Argentina"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              Monedas asociadas
            </Label>
            <div className="flex flex-wrap gap-2">
              {currencies.map((c) => {
                const selected = form.currencyCodes.includes(c.code)
                return (
                  <button
                    key={c.code}
                    onClick={() => toggleCurrency(c.code)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={
                      selected
                        ? { background: "var(--app-accent)", color: "var(--app-accent-foreground)" }
                        : { background: "var(--muted)", color: "var(--muted-foreground)" }
                    }
                  >
                    {c.code}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-row gap-2 mt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            style={{ background: "var(--app-accent)", color: "var(--app-accent-foreground)" }}
            onClick={handleSubmit}
          >
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const router = useRouter()

  // Stores
  const {
    displayCurrencyCode,
    theme,
    accentColor,
    currencies,
    countries,
    setDisplayCurrency,
    setTheme,
    setAccentColor,
    addCurrency,
    removeCurrency,
    addCountry,
    removeCountry,
  } = useSettingsStore()

  const { rates, setRate } = useRatesStore()
  const { currentUser, logout, updateProfile } = useAuthStore()
  const { transactions } = useTransactionsStore()

  // Computed
  const allCurrencies = currencies.length > 0 ? currencies : DEFAULT_CURRENCIES

  // Local state
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(currentUser?.name ?? "")
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({})
  const [showAddCurrency, setShowAddCurrency] = useState(false)
  const [showAddCountry, setShowAddCountry] = useState(false)

  // ── Profile actions ────────────────────────────────────────────────────────

  function handleSaveName() {
    if (!nameInput.trim()) return
    updateProfile({ name: nameInput.trim() })
    setEditingName(false)
    toast.success("Nombre actualizado")
  }

  function handleLogout() {
    logout()
    router.push("/login")
  }

  // ── Rate actions ───────────────────────────────────────────────────────────

  function handleRateUpdate(currencyCode: string) {
    const raw = rateInputs[currencyCode]
    const val = parseFloat(raw)
    if (!raw || isNaN(val) || val <= 0) {
      toast.error("Ingresá un tipo de cambio válido")
      return
    }
    setRate(currencyCode, val)
    setRateInputs((prev) => ({ ...prev, [currencyCode]: "" }))
    toast.success(`Tipo de cambio de ${currencyCode} actualizado`)
  }

  function getRateValue(currencyCode: string): number {
    return rates.find((r) => r.currencyCode === currencyCode)?.perUSD ?? 1
  }

  function getRateUpdatedAt(currencyCode: string): string | null {
    const r = rates.find((r) => r.currencyCode === currencyCode)
    if (!r?.updatedAt) return null
    try {
      return format(new Date(r.updatedAt), "d MMM yyyy, HH:mm", { locale: es })
    } catch {
      return null
    }
  }

  // ── Currency remove ────────────────────────────────────────────────────────

  function handleRemoveCurrency(code: string) {
    const inUse = transactions.some((t) => t.currencyCode === code)
    if (inUse) {
      toast.error(`No se puede eliminar ${code} — tiene movimientos asociados`)
      return
    }
    removeCurrency(code)
    toast.success(`Moneda ${code} eliminada`)
  }

  // ── Accent preview color ───────────────────────────────────────────────────

  const selectedAccentHex =
    ACCENT_COLORS.find((c) => c.value === accentColor)?.hex ?? "#10b981"

  return (
    <div className="pb-24">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-12 pb-6">
        <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase mb-0.5">
          Ajustes
        </p>
        <h1 className="text-2xl font-black text-foreground tracking-tight">
          Configuración
        </h1>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          1. Perfil
      ══════════════════════════════════════════════════════════════════════ */}
      <Section icon={User} title="Perfil">
        {/* Avatar + name */}
        <Row>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold flex-shrink-0"
              style={{
                background: "var(--app-accent)",
                color: "var(--app-accent-foreground)",
              }}
            >
              {currentUser?.name
                ? currentUser.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
                : "?"}
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName()
                      if (e.key === "Escape") setEditingName(false)
                    }}
                  />
                  <button onClick={handleSaveName} className="p-1 rounded-lg text-emerald-500">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingName(false)} className="p-1 rounded-lg text-muted-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {currentUser?.name ?? "Usuario"}
                  </p>
                  <button
                    onClick={() => {
                      setNameInput(currentUser?.name ?? "")
                      setEditingName(true)
                    }}
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {currentUser?.email ?? "—"}
              </p>
            </div>
          </div>
        </Row>

        {/* Logout */}
        <Row last>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between py-0.5 transition-opacity active:opacity-70"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-500/10">
                <LogOut className="w-4 h-4 text-red-500" />
              </div>
              <span className="text-sm font-semibold text-red-500">Cerrar sesión</span>
            </div>
            <ChevronRight className="w-4 h-4 text-red-400" />
          </button>
        </Row>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          2. Apariencia
      ══════════════════════════════════════════════════════════════════════ */}
      <Section icon={Palette} title="Apariencia">
        {/* Theme */}
        <Row>
          <p className="text-xs font-semibold text-muted-foreground mb-2.5">Tema</p>
          <div className="flex gap-2">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className="flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-all active:scale-95"
                style={
                  theme === value
                    ? {
                        background: "color-mix(in oklch, var(--app-accent) 15%, var(--background))",
                        border: "1.5px solid var(--app-accent)",
                      }
                    : {
                        background: "var(--muted)",
                        border: "1.5px solid transparent",
                      }
                }
              >
                <Icon
                  className="w-4 h-4"
                  style={{ color: theme === value ? "var(--app-accent)" : "var(--muted-foreground)" }}
                />
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: theme === value ? "var(--app-accent)" : "var(--muted-foreground)" }}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>
        </Row>

        {/* Accent color */}
        <Row>
          <p className="text-xs font-semibold text-muted-foreground mb-2.5">Color de acento</p>
          <div className="flex items-center gap-3 mb-3">
            {ACCENT_COLORS.map(({ value, label, hex }) => (
              <button
                key={value}
                onClick={() => setAccentColor(value)}
                title={label}
                className="w-9 h-9 rounded-full transition-all active:scale-90 relative flex items-center justify-center"
                style={{ background: hex }}
              >
                {accentColor === value && (
                  <Check className="w-4 h-4 text-white" strokeWidth={3} />
                )}
              </button>
            ))}
          </div>
          {/* Preview */}
          <div
            className="rounded-2xl p-3 flex items-center justify-between"
            style={{
              background: `${selectedAccentHex}18`,
              border: `1px solid ${selectedAccentHex}33`,
            }}
          >
            <p className="text-xs font-medium text-foreground">Vista previa</p>
            <button
              className="px-3 py-1.5 rounded-full text-xs font-bold text-white transition-all"
              style={{ background: selectedAccentHex }}
            >
              Botón de acción
            </button>
          </div>
        </Row>

        {/* Display currency */}
        <Row last>
          <p className="text-xs font-semibold text-muted-foreground mb-2.5">Moneda de visualización</p>
          <Select value={displayCurrencyCode} onValueChange={(v) => v && setDisplayCurrency(v)}>
            <SelectTrigger className="w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allCurrencies.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          3. Tipos de cambio
      ══════════════════════════════════════════════════════════════════════ */}
      <Section icon={RefreshCw} title="Tipos de cambio">
        {allCurrencies.map((currency, idx) => {
          const currentRate = getRateValue(currency.code)
          const updatedAt = getRateUpdatedAt(currency.code)
          const isLast = idx === allCurrencies.length - 1
          const isUSD = currency.code === "USD"

          return (
            <Row key={currency.code} last={isLast}>
              <div className="flex items-start gap-3">
                {/* Flag / Code badge */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{
                    background: "color-mix(in oklch, var(--app-accent) 12%, var(--muted))",
                    color: "var(--app-accent)",
                  }}
                >
                  {currency.code.slice(0, 3)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-foreground">{currency.name}</p>
                    {updatedAt && (
                      <p className="text-[10px] text-muted-foreground">{updatedAt}</p>
                    )}
                  </div>

                  {isUSD ? (
                    <p className="text-xs text-muted-foreground">
                      Moneda base — 1 USD = 1 USD
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <div
                          className="flex-1 flex items-center rounded-xl overflow-hidden"
                          style={{ border: "1px solid var(--border)", background: "var(--background)" }}
                        >
                          <Input
                            type="number"
                            placeholder={String(currentRate)}
                            value={rateInputs[currency.code] ?? ""}
                            onChange={(e) =>
                              setRateInputs((prev) => ({ ...prev, [currency.code]: e.target.value }))
                            }
                            className="border-0 h-9 text-sm rounded-none bg-transparent focus-visible:ring-0"
                          />
                          <span className="text-xs text-muted-foreground px-3 whitespace-nowrap">
                            por 1 USD
                          </span>
                        </div>
                        <Button
                          size="sm"
                          className="h-9 px-3 rounded-xl text-xs font-bold"
                          style={{ background: "var(--app-accent)", color: "var(--app-accent-foreground)" }}
                          onClick={() => handleRateUpdate(currency.code)}
                          disabled={!rateInputs[currency.code]}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        Actual: {currentRate.toLocaleString("es-AR")} {currency.code} = 1 USD
                      </p>
                      {currency.code === "ARS" && (
                        <div
                          className="flex items-start gap-1.5 mt-2 rounded-xl p-2"
                          style={{ background: "color-mix(in oklch, var(--app-accent) 8%, var(--muted))" }}
                        >
                          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "var(--app-accent)" }} />
                          <p className="text-[10px] text-muted-foreground leading-relaxed">
                            Tip: podés usar el valor del dólar blue para ARS
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </Row>
          )
        })}
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          4. Monedas configuradas
      ══════════════════════════════════════════════════════════════════════ */}
      <Section icon={DollarSign} title="Monedas configuradas">
        {allCurrencies.map((c, idx) => {
          const inUse = transactions.some((t) => t.currencyCode === c.code)
          const isLast = idx === allCurrencies.length - 1
          return (
            <Row key={c.code} last={isLast}>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0"
                  style={{ background: "color-mix(in oklch, var(--app-accent) 12%, var(--muted))", color: "var(--app-accent)" }}
                >
                  {c.symbol}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{c.code}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.name}</p>
                </div>
                {inUse && (
                  <Badge variant="secondary" className="text-[10px] shrink-0">en uso</Badge>
                )}
                <button
                  onClick={() => handleRemoveCurrency(c.code)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </Row>
          )
        })}

        {/* Add button */}
        <div className="p-3" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={() => setShowAddCurrency(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold transition-all active:scale-98"
            style={{
              background: "color-mix(in oklch, var(--app-accent) 10%, var(--muted))",
              color: "var(--app-accent)",
            }}
          >
            <Plus className="w-4 h-4" />
            Agregar moneda
          </button>
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          5. Países configurados
      ══════════════════════════════════════════════════════════════════════ */}
      <Section icon={Globe} title="Países configurados">
        {countries.map((country, idx) => {
          const isLast = idx === countries.length - 1
          return (
            <Row key={country.code} last={isLast}>
              <div className="flex items-center gap-3">
                <span className="text-2xl flex-shrink-0">{country.flag}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{country.name}</p>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {country.currencyCodes.map((code) => (
                      <Badge key={code} variant="secondary" className="text-[10px]">
                        {code}
                      </Badge>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => {
                    removeCountry(country.code)
                    toast.success(`País ${country.name} eliminado`)
                  }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </Row>
          )
        })}

        {/* Add button */}
        <div className="p-3" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={() => setShowAddCountry(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold transition-all active:scale-98"
            style={{
              background: "color-mix(in oklch, var(--app-accent) 10%, var(--muted))",
              color: "var(--app-accent)",
            }}
          >
            <Plus className="w-4 h-4" />
            Agregar país
          </button>
        </div>
      </Section>

      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}
      <AddCurrencyDialog open={showAddCurrency} onOpenChange={setShowAddCurrency} />
      <AddCountryDialog
        open={showAddCountry}
        onOpenChange={setShowAddCountry}
        currencies={allCurrencies}
      />
    </div>
  )
}
