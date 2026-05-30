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

const registroSchema = z
  .object({
    name: z
      .string()
      .min(1, "El nombre es obligatorio")
      .min(2, "El nombre debe tener al menos 2 caracteres"),
    email: z
      .string()
      .min(1, "El email es obligatorio")
      .email("Ingresá un email válido"),
    password: z
      .string()
      .min(1, "La contraseña es obligatoria")
      .min(6, "La contraseña debe tener al menos 6 caracteres"),
    confirmPassword: z.string().min(1, "Confirmá tu contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })

type RegistroFormValues = z.infer<typeof registroSchema>

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RegistroPage() {
  const router = useRouter()
  const register_user = useAuthStore((s) => s.register)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegistroFormValues>({
    resolver: zodResolver(registroSchema),
  })

  async function onSubmit(data: RegistroFormValues) {
    setServerError(null)
    const result = register_user(data.name, data.email, data.password)
    if (result.success) {
      router.push("/")
    } else {
      setServerError(result.error ?? "Error al crear la cuenta")
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
          background: "color-mix(in oklch, var(--card) 92%, transparent)",
          border: "1px solid color-mix(in oklch, var(--border) 60%, transparent)",
          boxShadow:
            "0 2px 40px color-mix(in oklch, var(--app-accent) 8%, transparent), 0 1px 0 color-mix(in oklch, white 6%, transparent) inset",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-lg font-bold text-foreground">Crear cuenta</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registrate para empezar a controlar tus finanzas
          </p>
        </div>

        <div className="px-6 pb-6 pt-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-foreground/80">
                Nombre
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Tu nombre"
                autoComplete="name"
                className="h-12 rounded-xl border-border/50 text-sm"
                style={{
                  background: "color-mix(in oklch, var(--muted) 60%, transparent)",
                }}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

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
                  background: "color-mix(in oklch, var(--muted) 60%, transparent)",
                }}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
                Contraseña
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

            {/* Confirm password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground/80">
                Confirmar contraseña
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repetí tu contraseña"
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
                  Creando cuenta…
                </>
              ) : (
                "Crear cuenta"
              )}
            </Button>
          </form>

          {/* Login link */}
          <p className="mt-5 text-center text-sm text-muted-foreground">
            ¿Ya tenés cuenta?{" "}
            <Link
              href="/login"
              className="font-semibold hover:opacity-80 transition-opacity"
              style={{ color: "var(--app-accent)" }}
            >
              Iniciá sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
