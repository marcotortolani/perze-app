/**
 * El mail de `signInWithOtp` con la plantilla default de Supabase trae un
 * link a `<supabase>/auth/v1/verify?...&redirect_to=<site_url>`. Ese
 * endpoint verifica y redirige al site URL con los tokens en el FRAGMENT
 * (`#access_token=...&refresh_token=...`, flujo implícito) — que el
 * cliente PKCE de `@supabase/ssr` no consume solo, y que el proxy jamás ve
 * (el fragment no viaja al servidor). Sin consumirlo, el usuario que hizo
 * click en el mail aterriza en A2 con una sesión válida colgando de la URL
 * y la pantalla le vuelve a pedir el email.
 *
 * Módulo separado sin depender de `window` ni de Supabase, para poder
 * testear el parseo solo (mismo criterio que `safe-next-path.ts`).
 */
export type AuthHashResult =
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "error"; code: string }
  | null;

export function parseAuthHash(hash: string): AuthHashResult {
  if (!hash || hash === "#") return null;
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    return { kind: "tokens", accessToken, refreshToken };
  }

  // GoTrue reporta el fallo también por fragment: `#error=access_denied&
  // error_code=otp_expired&error_description=...` (link vencido o ya usado).
  const errorCode = params.get("error_code") ?? params.get("error");
  if (errorCode) return { kind: "error", code: errorCode };

  return null;
}
