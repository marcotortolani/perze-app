import type { CSSProperties, ReactNode } from "react";

export interface BenchmarkItem {
  label: string;
  value: number;
}

export interface BenchmarkBarsProps {
  /** El sujeto en slot 1 — es el único que gasta color de identidad. */
  subject: BenchmarkItem;
  /** Las referencias van en gris, nunca en un slot de datos. */
  benchmarks: BenchmarkItem[];
  display?: ((value: number) => ReactNode) | undefined;
  style?: CSSProperties | undefined;
}

/** LIB-10: comparación de una posición contra benchmarks — el sujeto en slot 1, las referencias en gris. */
export function BenchmarkBars({ subject, benchmarks, display, style }: BenchmarkBarsProps) {
  const all = [subject, ...benchmarks];
  const max = Math.max(...all.map((i) => Math.abs(i.value)), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, ...style }}>
      {all.map((item, i) => {
        const isSubject = i === 0;
        return (
          <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: isSubject ? 600 : 400, color: isSubject ? "var(--text-primary)" : "var(--text-secondary)" }}>{item.label}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 13, color: "var(--text-secondary)" }}>
                {display ? display(item.value) : item.value}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "var(--surface-2)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.max(2, (Math.abs(item.value) / max) * 100)}%`,
                  borderRadius: 3,
                  background: isSubject ? "var(--data-1)" : "var(--text-muted)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
