import type { CSSProperties } from "react";

export interface SparklineProps {
  values: number[];
  width?: number | undefined;
  height?: number | undefined;
  color?: string | undefined;
  style?: CSSProperties | undefined;
}

/** Línea de tendencia de 2px sin ejes, para insight cards y filas de lista. */
export function Sparkline({ values = [], width = 96, height = 28, color = "var(--data-1)", style }: SparklineProps) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i): [number, number] => [
    (i / Math.max(values.length - 1, 1)) * width,
    height - ((v - min) / span) * (height - 4) - 2,
  ]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", ...style }}>
      <path d={d} fill="none" stroke={color} strokeWidth="var(--line-width)" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
