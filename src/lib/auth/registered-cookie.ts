/**
 * C7 — marca de que este dispositivo ya vio una cuenta registrada
 * (mismo patrón que `lib/demo/demo-cookie.ts`: nombre compartido entre
 * `proxy.ts`, server, y el cliente; sin datos personales, solo la marca).
 * No es una sesión — la sesión real la maneja `@supabase/ssr` en sus
 * propias cookies. Esta decide, cuando NO hay sesión viva, si mostrar
 * `/login` (ya hubo una cuenta acá) o `/onboarding` (primera vez).
 *
 * Se setea al completar `/onboarding/register` y en cada login con
 * contraseña — nunca se borra en `signOut()`: el punto es que el
 * dispositivo recuerde que ya hubo una cuenta, no que siga habiendo sesión.
 */
export const REGISTERED_COOKIE_NAME = "perze_registered";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function isRegisteredCookieValue(value: string | undefined): boolean {
  return value === "1";
}

export function markRegistered(): void {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${REGISTERED_COOKIE_NAME}=1; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax${secure}`;
}
