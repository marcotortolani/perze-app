import { householdsRepo } from "../repos/households-repo";
import { getPendingInviteCode } from "./pending-invite";

export type OnboardingDestination = "/" | "/onboarding/country" | "/onboarding/restore" | "/join";

/**
 * C7 — punto único donde se decide a dónde va alguien con sesión válida y
 * sin household local todavía. Antes de mandarlo a A4 (que termina creando
 * un household nuevo), chequea si YA es miembro de uno en el servidor —
 * típico de un navegador/dispositivo distinto al que usó para registrarse
 * la primera vez. Si lo es, `/onboarding/restore` baja sus datos con
 * `hydrateFromRemote()` (AC-1, `docs/auditoria-acceso.md`) en vez de dejar
 * que el onboarding cree un segundo household duplicado en silencio.
 *
 * Puede lanzar (sin red, Supabase pausado) — el caller decide qué mostrar
 * (AC-9): nunca degradar en silencio hacia `/onboarding/country`, que es el
 * camino que crea el duplicado.
 *
 * El invitado que se registró para entrar a un household ajeno es el mismo
 * problema con otra cara: sin el chequeo de `pending-invite.ts` termina en
 * A4 creando el suyo propio, y la invitación queda sin canjear.
 */
export async function resolveOnboardingDestination(): Promise<OnboardingDestination> {
  const localHouseholdId = await householdsRepo.getCurrentHouseholdId();
  if (localHouseholdId) return "/";

  if (getPendingInviteCode()) return "/join";

  const hasRemote = await householdsRepo.hasRemoteHousehold();
  if (hasRemote) return "/onboarding/restore";

  return "/onboarding/country";
}
