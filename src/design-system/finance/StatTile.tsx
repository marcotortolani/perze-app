import type { CSSProperties, ReactNode } from "react";

export interface StatTileProps {
  /** Nivel caption, uppercase. */
  label: string;
  /** La cifra. Pasar un `<Amount>` o un string ya formateado. */
  value: ReactNode;
  /** Delta con signo y flecha, p. ej. "↑ 4,2%". */
  delta?: ReactNode | undefined;
  deltaPolarity?: "positive" | "negative" | "neutral" | undefined;
  /** Contexto de comparación, p. ej. "vs. junio". */
  deltaNote?: ReactNode | undefined;
  style?: CSSProperties | undefined;
}

/** Tile de KPI: label en caption, cifra héroe, delta con signo. Sin borde, sin ícono. */
export function StatTile({ label, value, delta, deltaPolarity = "neutral", deltaNote, style }: StatTileProps) {
  const color =
    deltaPolarity === "positive" ? "var(--money-positive)" : deltaPolarity === "negative" ? "var(--money-negative-emphasis)" : "var(--text-secondary)";
  return (
    <div style={style}>
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 11,
          lineHeight: "16px",
          fontWeight: 600,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 30, lineHeight: "36px", fontWeight: 600, letterSpacing: "-.015em", marginTop: 6, color: "var(--text-primary)" }}>
        {value}
      </div>
      {delta || deltaNote ? (
        <div style={{ fontSize: 13, lineHeight: "18px", marginTop: 4, color: "var(--text-secondary)" }}>
          {delta ? <span style={{ color }}>{delta}</span> : null}
          {delta && deltaNote ? " " : ""}
          {deltaNote}
        </div>
      ) : null}
    </div>
  );
}
