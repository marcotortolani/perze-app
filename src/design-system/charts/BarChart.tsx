import type { CSSProperties } from "react";

export interface BarDatum {
  label: string;
  value: number;
  /** Override solo para mantener una entidad en su slot de datos fijo. */
  color?: string | undefined;
  /** Valor formateado, se dibuja solo en la barra máxima. */
  display?: string | undefined;
}

export interface BarChartProps {
  data: BarDatum[];
  height?: number | undefined;
  /** Gráficos de una sola serie van en neutro o primario — nunca un color elegido "porque queda lindo". */
  color?: string | undefined;
  gridLines?: number | undefined;
  /** Labels directos selectivos únicamente — nunca un número sobre cada barra. */
  labelExtremes?: boolean | undefined;
  style?: CSSProperties | undefined;
}

/** Gráfico de barras: extremos redondeados de 4px anclados a la baseline, grilla recesiva, sin fondo de gráfico. */
export function BarChart({ data = [], height = 130, color = "var(--data-1)", gridLines = 3, labelExtremes = true, style }: BarChartProps) {
  const w = 320;
  const h = height;
  const base = h - 30;
  const max = Math.max(...data.map((d) => d.value), 1);
  const slot = w / Math.max(data.length, 1);
  const barW = Math.min(30, slot - 9);
  const maxIdx = data.findIndex((d) => d.value === max);
  const maxDatum = data[maxIdx];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block", ...style }}>
      {Array.from({ length: gridLines }, (_, i) => {
        const y = base - ((i + 1) / (gridLines + 1)) * base;
        return <line key={i} x1="0" y1={y} x2={w} y2={y} stroke="var(--gridline)" strokeWidth="1" />;
      })}
      {data.map((d, i) => {
        const bh = (d.value / max) * (base - 20);
        return <rect key={d.label} x={i * slot + (slot - barW) / 2} y={base - bh} width={barW} height={bh} rx="var(--bar-radius)" fill={d.color ?? color} />;
      })}
      <line x1="0" y1={base} x2={w} y2={base} stroke="var(--border)" strokeWidth="1" />
      {data.map((d, i) => (
        <text key={d.label} x={i * slot + slot / 2} y={base + 14} fontSize="9" fill="var(--text-muted)" textAnchor="middle" fontFamily="var(--font-sans)">
          {d.label}
        </text>
      ))}
      {labelExtremes && maxDatum ? (
        <text x={maxIdx * slot + slot / 2} y={base - (max / max) * (base - 20) - 6} fontSize="10" fill="var(--text-secondary)" textAnchor="middle" fontFamily="var(--font-mono)">
          {maxDatum.display ?? ""}
        </text>
      ) : null}
    </svg>
  );
}
