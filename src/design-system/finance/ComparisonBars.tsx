import type { CSSProperties, ReactNode } from "react";

export interface ComparisonMember {
  label: string;
  value: number;
  color: string;
}

export interface ComparisonCategory {
  label: string;
  members: ComparisonMember[];
}

export interface ComparisonBarsProps {
  /** Ya ordenado por monto por el caller — nunca por diferencia entre miembros. */
  categories: ComparisonCategory[];
  display?: ((value: number) => ReactNode) | undefined;
  style?: CSSProperties | undefined;
}

/** LIB-14: dos miembros por categoría — 6px de aire, sin separador, orden por monto. */
export function ComparisonBars({ categories, display, style }: ComparisonBarsProps) {
  const max = Math.max(...categories.flatMap((c) => c.members.map((m) => m.value)), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, ...style }}>
      {categories.map((cat) => (
        <div key={cat.label}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>{cat.label}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {cat.members.map((m) => (
              <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 56, fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {m.label}
                </span>
                <div style={{ flex: 1, height: 10, borderRadius: 3, background: "var(--surface-2)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.max(2, (m.value / max) * 100)}%`, borderRadius: 3, background: m.color }} />
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 12, color: "var(--text-secondary)", flexShrink: 0 }}>
                  {display ? display(m.value) : m.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
