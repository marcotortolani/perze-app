import { createClient } from "@/lib/supabase/client";

/**
 * `translateAuthError()` mapea cada código a `auth.errors.<code>` en
 * `messages/*.json` — copy que PROPONE la corrección, nunca la nombra
 * (`CLAUDE.md` — "Falta el final del dominio: probá vale.mendez@gmail.com",
 * nunca "email inválido"). `"other"` es el único caso sin traducción propia:
 * cae al mensaje crudo de Supabase (en inglés) antes que mostrar nada vacío.
 */
export type AuthErrorCode = "invalid_credentials" | "weak_password" | "rate_limited" | "other";

export interface PasswordAuthResult {
  errorCode: AuthErrorCode | null;
  /** Solo poblado junto con `errorCode: "other"` — el mensaje crudo de Supabase, sin traducir. */
  rawMessage?: string;
}

/**
 * Contraseña como alternativa al OTP (§1 del plan de acceso controlado) —
 * `signInWithOtp`/`verifyOtp` siguen siendo el camino por default; esto es
 * un método adicional, no un reemplazo. El backend ya está configurado
 * (`minimum_password_length = 8`, `password_requirements =
 * lower_upper_letters_digits` en `config.toml`, pusheados en la sesión
 * anterior) — lo único que faltaba era la UI y el mapeo de errores.
 */
export function mapError(message: string): PasswordAuthResult {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return { errorCode: "invalid_credentials" };
  }
  if (lower.includes("password") && (lower.includes("least") || lower.includes("character") || lower.includes("weak") || lower.includes("should contain"))) {
    return { errorCode: "weak_password" };
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return { errorCode: "rate_limited" };
  }
  return { errorCode: "other", rawMessage: message };
}

/**
 * Traduce un `PasswordAuthResult` a copy visible — separado de `mapError`
 * porque `useTranslations()` es un hook y este archivo no es un componente.
 * Cada pantalla llama esto con su propio `t` de `next-intl`.
 */
// `t` tipado como función genérica, no `ReturnType<typeof useTranslations>`:
// el tipo de `next-intl` para las keys es una unión recursiva sobre las 68
// secciones de `messages/es.json`, y TS la marca "too complex to represent"
// en cuanto se la usa fuera del cuerpo de un componente. Cada caller pasa su
// `t` de `useTranslations()` tal cual — sigue type-safe ahí, donde importa.
export function translateAuthError(result: PasswordAuthResult, t: (key: string) => string): string {
  switch (result.errorCode) {
    case "invalid_credentials":
      return t("auth.errors.invalid_credentials");
    case "weak_password":
      return t("auth.errors.weak_password");
    case "rate_limited":
      return t("auth.errors.rate_limited");
    case "other":
    default:
      return result.rawMessage ?? t("auth.errors.other");
  }
}

export async function signInWithPassword(email: string, password: string): Promise<{ errorCode: AuthErrorCode | null; rawMessage?: string }> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? mapError(error.message) : { errorCode: null };
}

/**
 * Define o cambia la contraseña de la sesión actual — usado tanto por
 * `more/security` (con sesión normal) como por `/onboarding/register` y
 * `/reset-password` (con la sesión que deja `/auth/callback` al canjear
 * el link de verificación o de recovery).
 */
export async function setOwnPassword(password: string): Promise<PasswordAuthResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  return error ? mapError(error.message) : { errorCode: null };
}

/**
 * C7 — dispara la plantilla "recovery" de Supabase (`type=recovery`,
 * default del plan gratuito, sin plantilla propia — igual que el magic
 * link). `auth/callback/route.ts` ya sabía canjear `recovery` en
 * `EMAIL_OTP_TYPES`; lo único que faltaba era esta llamada y las pantallas
 * de `/forgot-password` → `/reset-password`.
 */
export async function requestPasswordReset(email: string): Promise<PasswordAuthResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
  });
  return error ? mapError(error.message) : { errorCode: null };
}
