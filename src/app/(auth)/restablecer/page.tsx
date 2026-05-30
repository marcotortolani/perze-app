"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, TrendingUp, ArrowLeft } from "lucide-react"

import { useAuthStore } from "@/stores/auth-store"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

// ─── Schema ───────────────────────────────────────────────────────────────────

const restablecerSchema = z
  .object({
    email: z
      .string()
      .min(1, "El email es obligatorio")
      .email("Ingresá un email válido"),
    password: z
      .string()
      .min(1, "La contraseña es obligatoria")
      .min(6, "La contraseña debe tener al menos 6 caracteres"),
    confirmPassword: z.string().min(1, "Confirmá tu nueva contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })

type RestablecerFormValues = z.infer<typeof restablecerSchema>

// ─── Inner form (reads search params) ────────────────────────────────────────

function RestablecerForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillEmail = searchParams.get("email") ?? ""

  const resetPassword = useAuthStore((s) => s.resetPassword)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RestablecerFormValues>({
    resolver: zodResolver(restablecerSchema),
    defaultValues: {
      email: prefillEmail,
    },
  })

  async function onSubmit(data: RestablecerFormValues) {
    setServerError(null)
    const result = resetPassword(data.email, data.password)
    if (result.success) {
      router.push("/login?reset=ok")
    } else {
      setServerError(result.error ?? "Error al restablecer la contraseña")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
          Email de tu cuenta
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="tu@email.com"
          autoComplete="email"
          className="h-12 rounded-xl border-border/50 text-sm"
          style={{
            background: "color-mix(in oklch, var(--muted) 60%, transparent)",
          }}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      {/* New password */}
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
          Nueva contraseña
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="Mínimo 6 caracteres"
          autoComplete="new-password"
          className="h-12 rounded-xl border-border/50 text-sm"
          style={{
            background: "color-mix(in oklch, var(--muted) 60%, transparent)",
          }}
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      {/* Confirm new password */}
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground/80">
          Confirmar nueva contraseña
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Repetí tu nueva contraseña"
          autoComplete="new-password"
          className="h-12 rounded-xl border-border/50 text-sm"
          style={{
            background: "color-mix(in oklch, var(--muted) 60%, transparent)",
          }}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">
            {errors.confirmPassword.message}
          </p>
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
            Restableciendo…
          </>
        ) : (
          "Restablecer contraseña"
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
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RestablecerPage() {
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
          <h2 className="text-lg font-bold text-foreground">
            Restablecer contraseña
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ingresá tu email y elegí una nueva contraseña
          </p>
        </div>

        <div className="px-6 pb-6 pt-4">
          <Suspense
            fallback={
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <RestablecerForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
