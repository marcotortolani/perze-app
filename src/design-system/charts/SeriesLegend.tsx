import type { CSSProperties } from "react";

const SLOTS = ["var(--data-1)", "var(--data-2)", "var(--data-3)", "var(--data-4)", "var(--data-5)", "var(--data-other)"];

export interface SeriesLegendItem {
  label: string;
  /** String de valor ya formateado (solo layout "table"). */
  value?: string | undefined;
  color?: string | undefined;
}

export interface SeriesLegendProps {
  /** Máximo 5 + "Otros"; los colores salen de los slots de datos fijos por índice. */
  series: SeriesLegendItem[];
  layout?: "table" | "inline" | undefined;
  /** Apagado por defecto: el sistema no tiene separadores entre filas de lista. */
  dividers?: boolean | undefined;
  style?: CSSProperties | undefined;
}

/** Leyenda / vista de tabla de un gráfico. El texto usa tokens de tinta; el chip de color porta la identidad de la serie. */
export function SeriesLegend({ series = [], layout = "table", dividers = false, style }: SeriesLegendProps) {
  const line = dividers ? "1px solid var(--border)" : "none";

  if (layout === "inline") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", ...style }}>
        {series.map((s, i) => (
          <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--text-secondary)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color ?? SLOTS[i % SLOTS.length] }} />
            {s.label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, ...style }}>
      <tbody>
        {series.map((s, i) => (
          <tr key={s.label}>
            <td style={{ padding: "10px 0", borderTop: line, color: "var(--text-primary)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color ?? SLOTS[i % SLOTS.length], display: "inline-block", marginRight: 7, verticalAlign: -1 }} />
              {s.label}
            </td>
            <td style={{ padding: "10px 0", borderTop: line, textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>
              {s.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
