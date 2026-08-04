/**
 * Clave de `localStorage` para el fondo decorativo de puntos (retícula
 * enmascarada, opt-in — ver `docs/02-design-system.md` § 1.8). Mismo patrón
 * que `THEME_STORAGE_KEY` (`src/lib/theme/constants.ts`): compartida entre
 * el script anti-flash de `layout.tsx` y el selector de Ajustes.
 */
export const BACKDROP_STORAGE_KEY = "perze-backdrop";

export type BackdropDensity = "loose" | "normal" | "tight";
export type BackdropIntensity = "subtle" | "normal" | "strong" | "vivid";

/**
 * Única fuente de verdad de los valores elegibles — el store y el script
 * anti-flash descartan cualquier otra cosa y caen al default. El usuario
 * puede ajustar densidad e intensidad, pero solo entre estos pasos por eje:
 * no hay forma de escribir un valor fuera del estándar de marca porque los
 * números (gap, color) viven en `globals.css`, no en lo que se persiste.
 */
export const BACKDROP_DENSITIES: BackdropDensity[] = ["loose", "normal", "tight"];
export const BACKDROP_INTENSITIES: BackdropIntensity[] = ["subtle", "normal", "strong", "vivid"];

export const BACKDROP_DENSITY_DEFAULT: BackdropDensity = "normal";
export const BACKDROP_INTENSITY_DEFAULT: BackdropIntensity = "normal";
