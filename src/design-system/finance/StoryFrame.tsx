import type { CSSProperties, ReactNode } from "react";

export interface StoryFrameProps {
  /** 0-based. */
  index: number;
  total: number;
  /** La cifra o gráfico protagonista del frame. */
  figure: ReactNode;
  /** Una línea de lectura, en palabras del usuario. */
  line: ReactNode;
  cover?: ReactNode | undefined;
  style?: CSSProperties | undefined;
}

/** LIB-11: frame de un "Wrapped" — progreso de N puntos arriba, figura, una línea de lectura. */
export function StoryFrame({ index, total, figure, line, cover, style }: StoryFrameProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px var(--screen-padding)", ...style }}>
      <div role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={total} style={{ display: "flex", gap: 4 }}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= index ? "var(--text-primary)" : "var(--surface-2)" }} />
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center" }}>
        {cover}
        <div>{figure}</div>
        <p style={{ margin: 0, fontSize: 17, lineHeight: "24px", color: "var(--text-primary)", maxWidth: "28ch", textWrap: "pretty" }}>{line}</p>
      </div>
    </div>
  );
}
