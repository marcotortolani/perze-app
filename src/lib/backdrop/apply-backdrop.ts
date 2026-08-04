import {
  BACKDROP_DENSITIES,
  BACKDROP_DENSITY_DEFAULT,
  BACKDROP_INTENSITIES,
  BACKDROP_INTENSITY_DEFAULT,
  BACKDROP_STORAGE_KEY,
  type BackdropDensity,
  type BackdropIntensity,
} from "./constants";

export interface BackdropPreference {
  enabled: boolean;
  density: BackdropDensity;
  intensity: BackdropIntensity;
}

const BACKDROP_DEFAULT: BackdropPreference = { enabled: false, density: BACKDROP_DENSITY_DEFAULT, intensity: BACKDROP_INTENSITY_DEFAULT };

/**
 * Lee la preferencia guardada, saneada — cualquier valor que no esté en
 * `BACKDROP_DENSITIES`/`BACKDROP_INTENSITIES` (JSON corrupto, un downgrade,
 * localStorage editado a mano) cae al default en vez de propagarse al DOM.
 * Mismo criterio que `getStoredThemePreference()` (`src/lib/theme/apply-theme.ts`).
 */
export function getStoredBackdropPreference(): BackdropPreference {
  if (typeof localStorage === "undefined") return BACKDROP_DEFAULT;
  const raw = localStorage.getItem(BACKDROP_STORAGE_KEY);
  if (!raw) return BACKDROP_DEFAULT;
  try {
    const parsed = JSON.parse(raw) as Partial<BackdropPreference>;
    const density = BACKDROP_DENSITIES.includes(parsed.density as BackdropDensity) ? (parsed.density as BackdropDensity) : BACKDROP_DENSITY_DEFAULT;
    const intensity = BACKDROP_INTENSITIES.includes(parsed.intensity as BackdropIntensity) ? (parsed.intensity as BackdropIntensity) : BACKDROP_INTENSITY_DEFAULT;
    return { enabled: parsed.enabled === true, density, intensity };
  } catch {
    return BACKDROP_DEFAULT;
  }
}

/**
 * Única escritura de `BACKDROP_STORAGE_KEY` fuera del script anti-flash.
 * Aplica de inmediato al DOM (sin esperar remount) y persiste para la
 * próxima carga. `data-backdrop-density`/`-intensity` se escriben siempre
 * (aunque `enabled` sea false) para que encenderlo no pierda la calibración
 * elegida antes.
 */
export function applyBackdropPreference(pref: BackdropPreference): void {
  const density = BACKDROP_DENSITIES.includes(pref.density) ? pref.density : BACKDROP_DENSITY_DEFAULT;
  const intensity = BACKDROP_INTENSITIES.includes(pref.intensity) ? pref.intensity : BACKDROP_INTENSITY_DEFAULT;
  const sanitized: BackdropPreference = { enabled: pref.enabled, density, intensity };
  if (typeof localStorage !== "undefined") localStorage.setItem(BACKDROP_STORAGE_KEY, JSON.stringify(sanitized));
  document.documentElement.setAttribute("data-backdrop", sanitized.enabled ? "on" : "off");
  document.documentElement.setAttribute("data-backdrop-density", density);
  document.documentElement.setAttribute("data-backdrop-intensity", intensity);
}
