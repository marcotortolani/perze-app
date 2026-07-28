import type { CSSProperties, ReactNode } from "react";

export interface GroupCardProps {
  caption: string;
  summary: string;
  /** Cifra editable — normalmente un `<Amount>` envuelto en un botón, o el editor de rate. */
  figure: ReactNode;
  actionLabel: string;
  onAction: () => void;
  style?: CSSProperties | undefined;
}

/**
 * Caption + resumen + cifra editable + acción secundaria — E8 (resolver
 * tipos de cambio faltantes en lote), donde esta composición aparece tres
 * veces en dos estados.
 */
export function GroupCard({ caption, summary, figure, actionLabel, onAction, style }: GroupCardProps) {
  return (
    <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 16, ...style }}>
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
        {caption}
      </div>
      <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>{summary}</div>
      <div style={{ marginTop: 10 }}>{figure}</div>
      <button
        type="button"
        onClick={onAction}
        style={{ marginTop: 10, background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--primary-ink)", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500 }}
      >
        {actionLabel}
      </button>
    </div>
  );
}
