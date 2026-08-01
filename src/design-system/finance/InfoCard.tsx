import type { CSSProperties, ReactNode } from "react";

export interface InfoCardProps {
  label: string;
  value: ReactNode;
  explanation: string;
  style?: CSSProperties | undefined;
}

/** LIB-12: el "tooltip" que el sistema no tiene — resuelto como card de una línea, sin scrim ni puntero. */
export function InfoCard({ label, value, explanation, style }: InfoCardProps) {
  return (
    <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 16, ...style }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 22, fontWeight: 600, color: "var(--text-primary)" }}>{value}</div>
      <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: "19px", color: "var(--text-secondary)", textWrap: "pretty" }}>{explanation}</p>
    </div>
  );
}
