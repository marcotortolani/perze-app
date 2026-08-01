import type { CSSProperties, ReactNode } from "react";

export interface DonutSlice {
  label: string;
  value: number;
  color?: string | undefined;
}

export interface DonutProps {
  /** Máximo 5 slots + "Otros" en gris — la regla de la paleta de datos aplica igual acá. */
  slices: DonutSlice[];
  /** Texto en el centro — típicamente el total, en `title`. */
  dimension?: ReactNode | undefined;
  onDrill?: ((label: string) => void) | undefined;
  size?: number | undefined;
  /** D12/auditoría — ver el mismo comentario en `BarChart.tsx`. */
  ariaLabel?: string | undefined;
  style?: CSSProperties | undefined;
}

const SLOTS = ["var(--data-1)", "var(--data-2)", "var(--data-3)", "var(--data-4)", "var(--data-5)", "var(--data-other)"];
const GAP_DEG = 2;

/** LIB-06: donut de composición — 5 slots + "Otros", separadores de 2px, total en el centro. */
export function Donut({ slices, dimension, onDrill, size = 180, ariaLabel, style }: DonutProps) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const summary = ariaLabel ?? slices.map((s) => `${s.label}: ${Math.round((s.value / total) * 100)}%`).join(", ");
  const radius = size / 2;
  const thickness = radius * 0.28;
  const innerRadius = radius - thickness;

  const cumulativeStarts = slices.reduce<number[]>((acc, s) => [...acc, (acc.at(-1) ?? -90) + (s.value / total) * 360], [-90]);

  const arcs = slices.map((s, i) => {
    const sweep = (s.value / total) * 360 - (slices.length > 1 ? GAP_DEG : 0);
    const start = cumulativeStarts[i]!;
    const end = start + Math.max(sweep, 0);

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const large = end - start > 180 ? 1 : 0;
    const p = (r: number, deg: number) => [radius + r * Math.cos(toRad(deg)), radius + r * Math.sin(toRad(deg))];
    const [x1, y1] = p(radius, start);
    const [x2, y2] = p(radius, end);
    const [x3, y3] = p(innerRadius, end);
    const [x4, y4] = p(innerRadius, start);
    const d = `M${x1} ${y1} A${radius} ${radius} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${innerRadius} ${innerRadius} 0 ${large} 0 ${x4} ${y4} Z`;

    return { d, color: s.color ?? SLOTS[i % SLOTS.length], label: s.label };
  });

  return (
    <div style={{ position: "relative", width: size, height: size, ...style }}>
      <svg role="img" aria-label={summary} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((a) => (
          <path
            key={a.label}
            d={a.d}
            fill={a.color}
            style={{ cursor: onDrill ? "pointer" : "default" }}
            onClick={onDrill ? () => onDrill(a.label) : undefined}
          />
        ))}
      </svg>
      {dimension ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-title-size)",
            fontWeight: 600,
            color: "var(--text-primary)",
            textAlign: "center",
          }}
        >
          {dimension}
        </div>
      ) : null}
    </div>
  );
}
