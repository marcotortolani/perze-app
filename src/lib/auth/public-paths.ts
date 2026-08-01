/**
 * Rutas que no requieren sesión — el flujo que TE LLEVA a tener una
 * (onboarding, login, unirse a un household por invitación), más `/offline`
 * (la pantalla de error de A3) y `/api/fx` (valida su propia sesión adentro
 * del route handler, F3). `/dev` es el playground de componentes, sin datos
 * de usuario — igual que ya lo trata `OnboardingGate` del lado cliente.
 *
 * Módulo separado de `proxy.ts` a propósito, sin depender de `@/env`: así
 * se puede testear el allowlist en sí sin mockear Supabase/NextRequest.
 */
const PUBLIC_PREFIXES = ["/onboarding", "/auth", "/join", "/offline", "/api/fx", "/dev"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
