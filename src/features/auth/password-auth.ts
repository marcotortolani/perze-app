import { createClient } from "@/lib/supabase/client";

export interface PasswordAuthResult {
  error: string | null;
}

/**
 * Contraseña como alternativa al OTP (§1 del plan de acceso controlado) —
 * `signInWithOtp`/`verifyOtp` siguen siendo el camino por default; esto es
 * un método adicional, no un reemplazo. El backend ya está configurado
 * (`minimum_password_length = 8`, `password_requirements =
 * lower_upper_letters_digits` en `config.toml`, pusheados en la sesión
 * anterior) — lo único que faltaba era la UI y el mapeo de errores.
 *
 * `mapError` traduce los mensajes de Supabase a copy que PROPONE la
 * corrección, nunca la nombra (`CLAUDE.md` — "Falta el final del dominio:
 * probá vale.mendez@gmail.com", nunca "email inválido").
 */
function mapError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "No encontramos una cuenta con esa combinación de email y contraseña — probá con el código por email en vez de la contraseña.";
  }
  if (lower.includes("password") && (lower.includes("least") || lower.includes("character") || lower.includes("weak") || lower.includes("should contain"))) {
    return "La contraseña necesita al menos 8 caracteres, con una mayúscula, una minúscula y un número.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Demasiados intentos seguidos — esperá un minuto y probá de nuevo.";
  }
  return message;
}

export async function signInWithPassword(email: string, password: string): Promise<PasswordAuthResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error ? mapError(error.message) : null };
}

/**
 * Define o cambia la contraseña de la sesión actual — el único camino de
 * escritura (§1): no hay recuperación por email todavía (`resetPasswordForEmail`
 * dispara la plantilla "recovery" de Supabase, bloqueada por el mismo límite
 * de plan gratuito que `magic_link`, y `auth/callback/route.ts` hoy solo
 * procesa el callback de OAuth — conectar el flujo de recuperación entero
 * es trabajo aparte, no una casilla de esta pasada).
 */
export async function setOwnPassword(password: string): Promise<PasswordAuthResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  return { error: error ? mapError(error.message) : null };
}
