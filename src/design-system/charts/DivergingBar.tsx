import type { CSSProperties } from "react";

export interface DivergingBarDatum {
  label: string;
  /** Positivo = aqua, negativo = naranja — nunca eje dual, un solo valor por barra. */
  value: number;
}

export interface DivergingBarProps {
  data: DivergingBarDatum[];
  height?: number | undefined;
  /** `zero` = línea base al medio (variación %); `center` reservado para casos con otro punto de referencia. */
  baseline?: "zero" | "center" | undefined;
  style?: CSSProperties | undefined;
}

/** LIB-18: barras divergentes — aqua/naranja desde una baseline central, para variación % o efecto FX. */
export function DivergingBar({ data, height = 140, style }: DivergingBarProps) {
  const w = 320;
  const midY = height / 2;
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const slot = w / Math.max(data.length, 1);
  const barW = Math.min(30, slot - 9);
  const halfHeight = midY - 10;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{ width: "100%", height: "auto", display: "block", ...style }}>
      <line x1="0" y1={midY} x2={w} y2={midY} stroke="var(--border)" strokeWidth="2" />
      {data.map((d, i) => {
        const h = (Math.abs(d.value) / max) * halfHeight;
        const positive = d.value >= 0;
        const y = positive ? midY - h : midY;
        const color = positive ? "var(--diverge-aqua-2)" : "var(--diverge-orange-2)";
        return <rect key={d.label} x={i * slot + (slot - barW) / 2} y={y} width={barW} height={Math.max(h, 0)} rx="var(--bar-radius)" fill={color} />;
      })}
      {data.map((d, i) => (
        <text key={`label-${d.label}`} x={i * slot + slot / 2} y={height - 2} fontSize="9" fill="var(--text-muted)" textAnchor="middle" fontFamily="var(--font-sans)">
          {d.label}
        </text>
      ))}
    </svg>
  );
}
