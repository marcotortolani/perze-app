import { THEME_STORAGE_KEY, type ThemePreference } from "./constants";

/**
 * Lee la preferencia guardada, sin resolver — `"system"` cuando no hay
 * override explícito. Mismo criterio que `getThemeInitScript()`, en TS en
 * vez de en el string inyectado en `<head>`: si uno de los dos cambia, el
 * otro tiene que actualizarse a mano, no hay forma de compartir código
 * entre un script inline pre-hidratación y un módulo normal.
 */
export function getStoredThemePreference(): ThemePreference {
  if (typeof localStorage === "undefined") return "system";
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

/**
 * Selector de tema de Ajustes (K3) — la única escritura de `THEME_STORAGE_KEY`
 * fuera del script anti-flash. Aplica la clase `.light` de inmediato (sin
 * esperar a un remount) y persiste la preferencia para la próxima carga.
 */
export function applyThemePreference(pref: ThemePreference): void {
  if (typeof localStorage !== "undefined") {
    if (pref === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  }
  const resolved = pref === "system" ? (typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : pref;
  document.documentElement.classList.toggle("light", resolved === "light");
}
