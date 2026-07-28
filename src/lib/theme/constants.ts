/**
 * Clave de `localStorage` para la preferencia de tema del usuario.
 * Compartida entre el script anti-flash de `layout.tsx` y el futuro
 * selector de tema de Ajustes (`docs/03-prompts-wireframes.md` § K3).
 */
export const THEME_STORAGE_KEY = "perze-theme";

export type ThemePreference = "light" | "dark" | "system";
