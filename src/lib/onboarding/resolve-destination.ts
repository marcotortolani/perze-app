import { householdsRepo } from "../repos/households-repo";

export type OnboardingDestination = "/" | "/onboarding/country" | "/onboarding/existing-household";

/**
 * C7 — punto único donde se decide a dónde va alguien con sesión válida y
 * sin household local todavía. Antes de mandarlo a A4 (que termina creando
 * un household nuevo), chequea si YA es miembro de uno en el servidor —
 * típico de un navegador/dispositivo distinto al que usó para registrarse
 * la primera vez. Sin esa guarda, completar el onboarding acá crea un
 * segundo household duplicado en silencio.
 */
export async function resolveOnboardingDestination(): Promise<OnboardingDestination> {
  const localHouseholdId = await householdsRepo.getCurrentHouseholdId();
  if (localHouseholdId) return "/";

  const hasRemote = await householdsRepo.hasRemoteHousehold();
  if (hasRemote) return "/onboarding/existing-household";

  return "/onboarding/country";
}
