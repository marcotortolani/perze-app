import type { CSSProperties } from "react";

export interface LogoProps {
  /** px — controla el tamaño de fuente; el resto de las proporciones lo derivan del sistema tipográfico. */
  size?: number | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Wordmark "PERZE" — única fuente de verdad para el logo de texto, para no
 * repetirlo a mano en cada lugar que lo necesita (`Sidebar`, onboarding).
 * La "Z" en tinta violeta (`--primary-ink`) es la única letra de marca:
 * el resto queda en `--text-primary`, mismo criterio que el resto del
 * sistema (el violeta se reserva para lo que significa algo, nunca
 * decorativo puro).
 */
export function Logo({ size = 18, style }: LogoProps) {
  return (
    <span
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: size,
        fontWeight: 700,
        letterSpacing: "-.01em",
        color: "var(--text-primary)",
        ...style,
      }}
    >
      {"PER"}
      <span style={{ color: "var(--primary-ink)" }}>{"Z"}</span>
      {"E"}
    </span>
  );
}
