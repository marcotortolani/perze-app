import type { CSSProperties, ReactNode } from "react";

export interface RankingBarItem {
  label: string;
  value: number;
  meta?: ReactNode | undefined;
}

export interface RankingBarProps {
  items: RankingBarItem[];
  /** Valor ya formateado por fila, mostrado a la derecha. */
  display?: ((value: number) => ReactNode) | undefined;
  style?: CSSProperties | undefined;
}

/** LIB-09: ranking horizontal — una sola serie, un solo color, orden ya resuelto por el caller. */
export function RankingBar({ items, display, style }: RankingBarProps) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, ...style }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 14, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 13, color: "var(--text-secondary)", flexShrink: 0 }}>
              {display ? display(item.value) : item.value}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "var(--surface-2)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.max(2, (item.value / max) * 100)}%`, borderRadius: 3, background: "var(--data-1)" }} />
          </div>
          {item.meta ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.meta}</span> : null}
        </div>
      ))}
    </div>
  );
}
