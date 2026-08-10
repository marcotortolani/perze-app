/**
 * B11 — `next` sin validar permitía un open redirect post-login:
 * `?next=@evil.com` produce `https://app.com@evil.com` (el navegador lee
 * todo antes de la `@` como userinfo y el host real pasa a ser
 * `evil.com`), y `?next=//evil.com` es un protocol-relative URL al mismo
 * origin ajeno. Solo se acepta un path que empiece con `/` y no con `//`
 * ni `/\` (ese segundo caso, un browser lo normaliza a `//`).
 *
 * Módulo separado de `route.ts` a propósito, sin depender de `@/env`
 * (igual que `lib/auth/public-paths.ts`): así se puede testear sin
 * mockear Supabase/`next/headers`.
 */
export function safeNextPath(next: string | null, fallback = "/onboarding/profile"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
