"use client"

import React, { useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Camera,
  ChevronLeft,
  Loader2,
  Sparkles,
  AlertTriangle,
  Settings,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Store,
  CalendarDays,
  Receipt,
  BadgePercent,
  Coins,
  FileText,
  ImagePlus,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { TransactionSheet, type TransactionPrefillValues } from "@/components/transaction-sheet"
import { useSettingsStore } from "@/stores/settings-store"
import type { ReceiptData } from "@/app/api/ai/scan-receipt/route"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapReceiptCategoryToApp(receiptCategory: string): string {
  const map: Record<string, string> = {
    food: "food",
    transport: "transport",
    housing: "housing",
    health: "health",
    entertainment: "entertainment",
    education: "education",
    clothing: "clothing",
    subscriptions: "subscriptions",
    services: "services",
    "other-expense": "other-expense",
  }
  return map[receiptCategory] ?? "other-expense"
}

function getCountryFromCurrency(
  currencyCode: string,
  countries: { code: string; currencyCodes: string[] }[]
): string {
  const match = countries.find((c) => c.currencyCodes.includes(currencyCode))
  return match?.code ?? countries[0]?.code ?? "AR"
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence > 0.8) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{ background: "oklch(0.7 0.17 162 / 0.15)", color: "oklch(0.45 0.17 162)" }}
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        Alta confianza {Math.round(confidence * 100)}%
      </span>
    )
  }
  if (confidence >= 0.5) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{ background: "oklch(0.78 0.16 85 / 0.15)", color: "oklch(0.52 0.16 85)" }}
      >
        <MinusCircle className="w-3.5 h-3.5" />
        Confianza media {Math.round(confidence * 100)}%
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: "oklch(0.65 0.22 15 / 0.12)", color: "oklch(0.5 0.22 15)" }}
    >
      <XCircle className="w-3.5 h-3.5" />
      Baja confianza {Math.round(confidence * 100)}%
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EscanearPage() {
  const router = useRouter()
  const { currencies, countries } = useSettingsStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ReceiptData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isApiKeyError, setIsApiKeyError] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [prefillValues, setPrefillValues] = useState<TransactionPrefillValues | null>(null)

  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setImageFile(file)
      setResult(null)
      setError(null)
      setIsApiKeyError(false)
      const url = URL.createObjectURL(file)
      setImagePreview(url)
    },
    []
  )

  const handleAnalyze = useCallback(async () => {
    if (!imageFile) return
    setLoading(true)
    setError(null)
    setResult(null)
    setIsApiKeyError(false)

    try {
      const formData = new FormData()
      formData.append("image", imageFile)

      const res = await fetch("/api/ai/scan-receipt", {
        method: "POST",
        body: formData,
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        const msg = json.error ?? "Error al analizar el ticket."
        if (res.status === 503 || res.status === 401) setIsApiKeyError(true)
        setError(msg)
        return
      }

      setResult(json.data as ReceiptData)
    } catch {
      setError("No se pudo conectar con el servidor. Revisá tu conexión.")
    } finally {
      setLoading(false)
    }
  }, [imageFile])

  const handleSave = useCallback(() => {
    if (!result) return

    const currencyCode = result.currency ?? currencies[0]?.code ?? "ARS"
    const countryCode = getCountryFromCurrency(currencyCode, countries)
    const categoryId = mapReceiptCategoryToApp(result.category)

    const notesParts: string[] = []
    if (result.notes) notesParts.push(result.notes)
    if (result.items.length > 0) {
      notesParts.push(
        "Items: " +
          result.items
            .map(
              (i) =>
                `${i.description}${i.quantity && i.quantity > 1 ? ` x${i.quantity}` : ""}`
            )
            .join(", ")
      )
    }

    setPrefillValues({
      type: "expense",
      amount: result.total,
      currencyCode,
      countryCode,
      categoryId,
      description: result.merchant || "Ticket escaneado",
      date: result.date ?? new Date().toISOString().split("T")[0],
      notes: notesParts.join(" | ") || undefined,
      source: "ai-receipt",
    })
    setSheetOpen(true)
  }, [result, currencies, countries])

  const handleReset = useCallback(() => {
    setImageFile(null)
    setImagePreview(null)
    setResult(null)
    setError(null)
    setIsApiKeyError(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  return (
    <div className="pb-24">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="px-4 pt-12 pb-6 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, color-mix(in oklch, #8b5cf6 10%, var(--background)), var(--background))",
        }}
      >
        <div
          className="absolute -top-8 -right-8 w-40 h-40 rounded-full blur-3xl opacity-15"
          style={{ background: "#8b5cf6" }}
        />

        <div className="relative z-10 flex items-center gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all active:scale-95"
            style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              IA · Gemini Vision
            </p>
            <h1 className="text-xl font-black text-foreground tracking-tight leading-tight">
              Escanear Ticket
            </h1>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs relative z-10">
          Fotografiá un ticket y Gemini extraerá el monto, fecha y categoría
          automáticamente.
        </p>
      </div>

      <div className="px-4 space-y-4">

        {/* ── Upload area ──────────────────────────────────────────────────── */}
        <div>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageChange}
            className="sr-only"
            ref={fileInputRef}
          />

          {imagePreview ? (
            <div
              className="relative rounded-3xl overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Vista previa del ticket"
                className="w-full object-contain max-h-72"
                style={{ background: "var(--muted)" }}
              />
              <div className="absolute bottom-3 right-3">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md transition-all active:scale-95"
                  style={{ background: "oklch(0 0 0 / 55%)", color: "white" }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Cambiar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-3xl flex flex-col items-center justify-center gap-4 py-12 transition-all active:scale-[0.98]"
              style={{
                border: "2px dashed color-mix(in oklch, #8b5cf6 40%, var(--border))",
                background: "color-mix(in oklch, #8b5cf6 4%, var(--card))",
              }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)" }}
              >
                <Camera className="w-8 h-8 text-white" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-foreground mb-1">
                  Tocá para subir o fotografiar un ticket
                </p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG o foto de cámara
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: "oklch(0.65 0.2 300 / 0.12)", color: "#8b5cf6" }}
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  Galería
                </span>
                <span
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: "oklch(0.65 0.2 300 / 0.12)", color: "#8b5cf6" }}
                >
                  <Camera className="w-3.5 h-3.5" />
                  Cámara
                </span>
              </div>
            </button>
          )}
        </div>

        {/* ── Analyze button ────────────────────────────────────────────────── */}
        <Button
          onClick={handleAnalyze}
          disabled={!imageFile || loading}
          className="w-full h-14 rounded-2xl text-base font-bold gap-2 transition-all"
          style={
            imageFile && !loading
              ? { background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "white" }
              : {}
          }
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Analizando con Gemini...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Analizar con IA
            </>
          )}
        </Button>

        {/* ── Loading skeleton ───────────────────────────────────────────────── */}
        {loading && (
          <div
            className="rounded-3xl p-5 space-y-3 overflow-hidden"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl animate-pulse" style={{ background: "var(--muted)" }} />
              <div className="flex-1 space-y-2">
                <div className="h-3 rounded-full animate-pulse w-3/4" style={{ background: "var(--muted)" }} />
                <div className="h-3 rounded-full animate-pulse w-1/2" style={{ background: "var(--muted)" }} />
              </div>
            </div>
            {[80, 55, 65, 40, 70].map((w, i) => (
              <div
                key={i}
                className="h-3 rounded-full animate-pulse"
                style={{ width: `${w}%`, background: "var(--muted)", animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        )}

        {/* ── Error state ───────────────────────────────────────────────────── */}
        {error && !loading && (
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
                  background: isApiKeyError
                    ? "#8b5cf622"
                    : "oklch(0.65 0.22 15 / 0.15)",
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
                  <button
                    onClick={() => router.push("/configuracion")}
                    className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                    style={{ background: "#8b5cf6", color: "white" }}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Ir a Configuración
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Result card ───────────────────────────────────────────────────── */}
        {result && !loading && (
          <div className="space-y-3">

            {/* Merchant + confidence */}
            <div
              className="rounded-3xl p-5 relative overflow-hidden"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div
                className="absolute -top-6 -right-6 w-28 h-28 rounded-full blur-2xl opacity-10"
                style={{ background: "#8b5cf6" }}
              />

              <div className="flex items-start justify-between gap-3 mb-3 relative z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #8b5cf622, #6366f122)" }}
                  >
                    <Store className="w-6 h-6" style={{ color: "#8b5cf6" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      Comercio detectado
                    </p>
                    <p className="text-lg font-black text-foreground leading-tight truncate">
                      {result.merchant || "Sin nombre"}
                    </p>
                  </div>
                </div>
                <ConfidenceBadge confidence={result.confidence} />
              </div>

              {/* Date & currency */}
              <div className="flex items-center gap-3 relative z-10 flex-wrap">
                {result.date && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {result.date}
                  </span>
                )}
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
                >
                  <Coins className="w-3.5 h-3.5" />
                  {result.currency}
                </span>
              </div>
            </div>

            {/* Items list */}
            {result.items.length > 0 && (
              <div
                className="rounded-3xl overflow-hidden"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              >
                <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Detalle del ticket
                  </p>
                </div>
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {result.items.map((item, idx) => (
                    <div key={idx} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground font-medium leading-tight truncate">
                          {item.description}
                        </p>
                        {item.quantity && item.quantity > 1 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.quantity} ×{" "}
                            {item.unitPrice?.toLocaleString("es-AR") ?? "—"}
                          </p>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground flex-shrink-0">
                        {item.total.toLocaleString("es-AR")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Totals breakdown */}
            <div
              className="rounded-3xl p-4 space-y-2.5"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              {result.subtotal !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium text-foreground">
                    {result.subtotal.toLocaleString("es-AR")}
                  </span>
                </div>
              )}
              {result.tax !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <BadgePercent className="w-3.5 h-3.5" />
                    IVA / Impuestos
                  </span>
                  <span className="font-medium text-foreground">
                    {result.tax.toLocaleString("es-AR")}
                  </span>
                </div>
              )}
              {(result.subtotal !== undefined || result.tax !== undefined) && (
                <div className="h-px" style={{ background: "var(--border)" }} />
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">Total</span>
                <span className="text-2xl font-black" style={{ color: "#8b5cf6" }}>
                  {result.currency} {result.total.toLocaleString("es-AR")}
                </span>
              </div>
            </div>

            {/* Notes from AI */}
            {result.notes && (
              <div
                className="rounded-2xl px-4 py-3 flex items-start gap-2"
                style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
              >
                <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">{result.notes}</p>
              </div>
            )}

            {/* Save CTA */}
            <Button
              onClick={handleSave}
              className="w-full h-14 rounded-2xl text-base font-bold gap-2"
              style={{ background: "oklch(0.7 0.17 162)", color: "white" }}
            >
              <ShoppingCart className="w-5 h-5" />
              Guardar como gasto
            </Button>
          </div>
        )}
      </div>

      {/* ── Transaction Sheet pre-filled ──────────────────────────────────── */}
      <TransactionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        defaultType="expense"
        prefillValues={prefillValues ?? undefined}
      />
    </div>
  )
}
