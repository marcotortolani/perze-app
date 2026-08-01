/** A1 se salta después de la primera vez — `localStorage`, no cuenta ni sesión. */
export const SAW_WELCOME_KEY = "perze:sawWelcome";

export function markWelcomeSeen(): void {
  if (typeof window !== "undefined") window.localStorage.setItem(SAW_WELCOME_KEY, "1");
}
