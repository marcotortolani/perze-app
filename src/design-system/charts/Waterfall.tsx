import type { CSSProperties } from "react";

export interface WaterfallDelta {
  label: string;
  value: number;
  color?: string | undefined;
}

export interface WaterfallProps {
  deltas: WaterfallDelta[];
  /** Invariante: la suma de `deltas` tiene que ser `total` — se verifica en desarrollo, nunca en producción. */
  total: number;
  height?: number | undefined;
  /** D12/auditoría — ver el mismo comentario en `BarChart.tsx`. */
  ariaLabel?: string | undefined;
  style?: CSSProperties | undefined;
}

const TOLERANCE = 0.01;

/** LIB-07: gráfico de cascada — cada barra parte de donde terminó la anterior. */
export function Waterfall({ deltas, total, height = 160, ariaLabel, style }: WaterfallProps) {
  if (process.env.NODE_ENV !== "production") {
    const sum = deltas.reduce((s, d) => s + d.value, 0);
    if (Math.abs(sum - total) > TOLERANCE) {
      throw new Error(`Waterfall: la suma de deltas (${sum}) no coincide con total (${total}) — invariante del componente (LIB-07).`);
    }
  }

  const w = 320;
  const base = height - 24;
  const values = deltas.reduce<number[]>((acc, d) => [...acc, (acc.at(-1) ?? 0) + d.value], []);
  const allValues = [0, ...values];
  const max = Math.max(...allValues, total, 1);
  const min = Math.min(...allValues, 0);
  const span = max - min || 1;
  const slot = w / deltas.length;
  const barW = Math.min(40, slot - 8);
  const scaleY = (v: number) => base - ((v - min) / span) * base;
  const summary = ariaLabel ?? deltas.map((d) => `${d.label}: ${d.value}`).join(", ");

  return (
    <svg role="img" aria-label={summary} viewBox={`0 0 ${w} ${height}`} style={{ width: "100%", height: "auto", display: "block", ...style }}>
      <line x1="0" y1={scaleY(0)} x2={w} y2={scaleY(0)} stroke="var(--border)" strokeWidth="1" />
      {deltas.map((d, i) => {
        const start = i === 0 ? 0 : values[i - 1]!;
        const end = values[i]!;
        const y = scaleY(Math.max(start, end));
        const barHeight = Math.abs(scaleY(start) - scaleY(end));
        const color = d.color ?? (d.value >= 0 ? "var(--money-positive)" : "var(--money-negative-emphasis)");
        return (
          <rect key={`${d.label}-${i}`} x={i * slot + (slot - barW) / 2} y={y} width={barW} height={Math.max(barHeight, 2)} rx="var(--bar-radius)" fill={color} />
        );
      })}
      {deltas.map((d, i) => (
        <text key={`label-${d.label}-${i}`} x={i * slot + slot / 2} y={height - 6} fontSize="9" fill="var(--text-muted)" textAnchor="middle" fontFamily="var(--font-sans)">
          {d.label}
        </text>
      ))}
    </svg>
  );
}
