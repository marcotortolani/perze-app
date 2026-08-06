/**
 * Rutas que no requieren sesión — el flujo que TE LLEVA a tener una
 * (onboarding, unirse a un household por invitación), más `/offline`
 * (la pantalla de error de A3) y `/api/fx` (valida su propia sesión adentro
 * del route handler, F3). `/dev` es el playground de componentes, sin datos
 * de usuario — igual que ya lo trata `OnboardingGate` del lado cliente.
 * `/about` es la página pública de marca, indexable y sin tab bar —
 * existe para que la "Application home page" de Google Auth Platform
 * apunte a algo que no sea un login (`docs/mejora-auth-oauth-y-email.md`
 * § 2, verificación de marca).
 *
 * `/login`, `/forgot-password` y `/reset-password` NO están acá a
 * propósito: son stubs de redirect de compatibilidad (CLAUDE.md § rutas,
 * la solución de transición de contraseñas se revirtió — ver
 * `docs/mejora-auth-oauth-y-email.md` § 0.1). Sin sesión, este chequeo ya
 * manda cualquier ruta no pública a `/onboarding` — el stub ni siquiera
 * llega a renderizar. Con sesión, el stub se monta y hace su propio
 * `redirect("/onboarding")`.
 *
 * Módulo separado de `proxy.ts` a propósito, sin depender de `@/env`: así
 * se puede testear el allowlist en sí sin mockear Supabase/NextRequest.
 */
const PUBLIC_PREFIXES = ["/onboarding", "/auth", "/join", "/offline", "/api/fx", "/dev", "/about"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
