/** A1 se salta después de la primera vez — `localStorage`, no cuenta ni sesión. */
export const SAW_WELCOME_KEY = "perze-saw-welcome";
/** Nombre viejo (convención `perze:*`, unificada a `perze-*`) — se lee una sola vez para no mandar de vuelta a A1 a quien ya la vio. */
const LEGACY_SAW_WELCOME_KEY = "perze:sawWelcome";

export function markWelcomeSeen(): void {
  if (typeof window !== "undefined") window.localStorage.setItem(SAW_WELCOME_KEY, "1");
}

export function hasSeenWelcome(): boolean {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(SAW_WELCOME_KEY) === "1") return true;
  if (window.localStorage.getItem(LEGACY_SAW_WELCOME_KEY) === "1") {
    window.localStorage.setItem(SAW_WELCOME_KEY, "1");
    window.localStorage.removeItem(LEGACY_SAW_WELCOME_KEY);
    return true;
  }
  return false;
}
