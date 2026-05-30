"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, TrendingUp, CheckCircle2, ArrowLeft } from "lucide-react"

import { useAuthStore } from "@/stores/auth-store"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

// ─── Schema ───────────────────────────────────────────────────────────────────

const recuperarSchema = z.object({
  email: z
    .string()
    .min(1, "El email es obligatorio")
    .email("Ingresá un email válido"),
})

type RecuperarFormValues = z.infer<typeof recuperarSchema>

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecuperarPage() {
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset)
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecuperarFormValues>({
    resolver: zodResolver(recuperarSchema),
  })

  async function onSubmit(data: RecuperarFormValues) {
    setServerError(null)
    // Always show success message regardless of whether email exists (security best practice)
    requestPasswordReset(data.email)
    setSent(true)
  }

  return (
    <div className="w-full max-w-sm relative">
      {/* Atmospheric radial gradient background */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at -10% -10%, color-mix(in oklch, var(--app-accent) 15%, transparent), transparent)",
        }}
      />
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 110% 110%, color-mix(in oklch, var(--app-accent) 8%, transparent), transparent)",
        }}
      />

      {/* Logo section */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, var(--app-accent), color-mix(in oklch, var(--app-accent) 70%, oklch(0.15 0.05 265)))",
            boxShadow:
              "0 8px 24px color-mix(in oklch, var(--app-accent) 40%, transparent)",
          }}
        >
          <TrendingUp className="w-7 h-7 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Finanzas
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Control financiero personal
          </p>
        </div>
      </div>

      {/* Glass card */}
      <div
        className="rounded-3xl overflow-hidden"
        style={{
          background: "color-mix(in oklch, var(--card) 92%, transparent)",
          border: "1px solid color-mix(in oklch, var(--border) 60%, transparent)",
          boxShadow:
            "0 2px 40px color-mix(in oklch, var(--app-accent) 8%, transparent), 0 1px 0 color-mix(in oklch, white 6%, transparent) inset",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-lg font-bold text-foreground">Recuperar contraseña</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Te enviaremos las instrucciones para restablecer tu contraseña
          </p>
        </div>

        <div className="px-6 pb-6 pt-4">
          {sent ? (
            /* Success state */
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{
                    background:
                      "color-mix(in oklch, var(--app-accent) 15%, transparent)",
                    border:
                      "1px solid color-mix(in oklch, var(--app-accent) 25%, transparent)",
                  }}
                >
                  <CheckCircle2
                    className="w-8 h-8"
                    style={{ color: "var(--app-accent)" }}
                  />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    Instrucciones enviadas
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    Si el email existe, recibirás las instrucciones para
                    restablecer tu contraseña.
                  </p>
                </div>
              </div>

              <Link href="/login">
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-xl font-medium border-border/50"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al inicio de sesión
                </Button>
              </Link>
            </div>
          ) : (
            /* Form state */
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  autoComplete="email"
                  className="h-12 rounded-xl border-border/50 text-sm"
                  style={{
                    background:
                      "color-mix(in oklch, var(--muted) 60%, transparent)",
                  }}
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              {/* Server error */}
              {serverError && (
                <div
                  className="rounded-xl px-3 py-2.5"
                  style={{
                    background:
                      "color-mix(in oklch, var(--destructive) 10%, transparent)",
                    border:
                      "1px solid color-mix(in oklch, var(--destructive) 25%, transparent)",
                  }}
                >
                  <p className="text-sm text-destructive">{serverError}</p>
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-12 rounded-xl font-semibold text-sm"
                style={{
                  background:
                    "linear-gradient(135deg, var(--app-accent), color-mix(in oklch, var(--app-accent) 80%, oklch(0.2 0.05 265)))",
                  boxShadow:
                    "0 4px 16px color-mix(in oklch, var(--app-accent) 35%, transparent)",
                  color: "white",
                  border: "none",
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  "Enviar instrucciones"
                )}
              </Button>

              {/* Back to login */}
              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Volver al inicio de sesión
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
