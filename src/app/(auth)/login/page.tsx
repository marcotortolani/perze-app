"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, TrendingUp } from "lucide-react"

import { useAuthStore } from "@/stores/auth-store"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

// ─── Schema ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "El email es obligatorio")
    .email("Ingresá un email válido"),
  password: z
    .string()
    .min(1, "La contraseña es obligatoria")
    .min(6, "La contraseña debe tener al menos 6 caracteres"),
})

type LoginFormValues = z.infer<typeof loginSchema>

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter()
  const login = useAuthStore((s) => s.login)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginFormValues) {
    setServerError(null)
    const result = login(data.email, data.password)
    if (result.success) {
      router.push("/")
    } else {
      setServerError(result.error ?? "Error al iniciar sesión")
    }
  }

  return (
    <div className="w-full">
      {/* Logo — hidden on desktop (shown in left panel by layout) */}
      <div className="md:hidden flex flex-col items-center gap-3 mb-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
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
          background:
            "color-mix(in oklch, var(--card) 92%, transparent)",
          border:
            "1px solid color-mix(in oklch, var(--border) 60%, transparent)",
          boxShadow:
            "0 2px 40px color-mix(in oklch, var(--app-accent) 8%, transparent), 0 1px 0 color-mix(in oklch, white 6%, transparent) inset",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-lg font-bold text-foreground">Iniciar sesión</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ingresá a tu cuenta para continuar
          </p>
        </div>

        <div className="px-6 pb-6 pt-4">
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

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
                  Contraseña
                </Label>
                <Link
                  href="/recuperar"
                  className="text-xs font-medium hover:opacity-80 transition-opacity"
                  style={{ color: "var(--app-accent)" }}
                >
                  Olvidé mi contraseña
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                className="h-12 rounded-xl border-border/50 text-sm"
                style={{
                  background:
                    "color-mix(in oklch, var(--muted) 60%, transparent)",
                }}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
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
              className="w-full h-12 rounded-xl font-semibold text-sm mt-1"
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
                  Iniciando sesión…
                </>
              ) : (
                "Iniciar sesión"
              )}
            </Button>
          </form>

          {/* Register link */}
          <p className="mt-5 text-center text-sm text-muted-foreground">
            ¿No tenés cuenta?{" "}
            <Link
              href="/registro"
              className="font-semibold hover:opacity-80 transition-opacity"
              style={{ color: "var(--app-accent)" }}
            >
              Registrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
