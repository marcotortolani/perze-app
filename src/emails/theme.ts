/**
 * Tokens de marca para email — Fase 1 de `docs/mejora-auth-oauth-y-email.md`.
 *
 * Un cliente de mail no ejecuta `globals.css`: nada de `var(--...)`, nada
 * de `color-mix()`, nada de `.dark`. Estos son los hexes resueltos del
 * **modo claro** de `docs/02-design-system.md`, elegido como default de
 * email porque Gmail, Outlook y buena parte de los clientes móviles
 * ignoran `prefers-color-scheme` — un email "oscuro" ahí sale con fondo
 * blanco y texto casi blanco, ilegible. No hay una variante oscura acá.
 *
 * Tampoco hay tipografía Geist: está autohospedada bajo un hash de Next
 * (`next/font/local`), inalcanzable desde un cliente de mail. El stack de
 * abajo es el fallback que declara `--font-sans` sin la primera var, con
 * Inter como alternativa oficial (`docs/02-design-system.md:221`).
 */
export const emailTheme = {
  color: {
    page: "#FAFAF9",
    surface1: "#FFFFFF",
    surface2: "#F5F5F4",
    border: "#E4E4E1",
    textPrimary: "#131315",
    textSecondary: "#5A5A60",
    textMuted: "#6B6B71",
    primaryFill: "#6D55F0",
    primaryOnFill: "#FFFFFF",
    aqua: "#0D7A58",
  },
  radius: {
    card: 20,
    button: 16,
    input: 14,
  },
  // Un solo violeta (`--primary-fill`), como en la app: nunca un segundo
  // tono de marca, nunca un degradado, nunca sombra (`CLAUDE.md` §
  // presupuesto de ruido — el mismo criterio aplica acá aunque no haya
  // lint que lo verifique en un archivo .tsx que no es pantalla).
  fontStack: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontStackMono: "'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace",
} as const;
