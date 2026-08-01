import type { CSSProperties } from "react";

export interface StackedBarSeries {
  label: string;
  color?: string | undefined;
}

export interface StackedBarGroup {
  label: string;
  /** Un valor por serie, mismo orden que `series`. */
  values: number[];
}

export interface StackedBarProps {
  groups: StackedBarGroup[];
  series: StackedBarSeries[];
  height?: number | undefined;
  /** Índice del grupo en curso (período actual) — se dibuja en gris, nunca en color de serie. */
  inProgressIndex?: number | undefined;
  style?: CSSProperties | undefined;
}

const SLOTS = ["var(--data-1)", "var(--data-2)", "var(--data-3)", "var(--data-4)", "var(--data-5)", "var(--data-other)"];
const SEPARATOR = 2;

/** LIB-18: barras apiladas — separador de 2px del color de superficie, radio 4 anclado a baseline, período en curso en gris. */
export function StackedBar({ groups, series, height = 160, inProgressIndex, style }: StackedBarProps) {
  const w = 320;
  const base = height - 20;
  const totals = groups.map((g) => g.values.reduce((s, v) => s + v, 0));
  const max = Math.max(...totals, 1);
  const slot = w / Math.max(groups.length, 1);
  const barW = Math.min(30, slot - 9);

  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{ width: "100%", height: "auto", display: "block", ...style }}>
      <line x1="0" y1={base} x2={w} y2={base} stroke="var(--border)" strokeWidth="1" />
      {groups.map((g, gi) => {
        const total = totals[gi] ?? 0;
        const x = gi * slot + (slot - barW) / 2;
        const inProgress = gi === inProgressIndex;
        const heights = g.values.map((v) => (total > 0 ? (v / max) * base : 0));
        const tops = heights.reduce<number[]>((acc, h) => [...acc, (acc.at(-1) ?? base) - (h > 0 ? h + SEPARATOR : 0)], [base]);
        return (
          <g key={g.label}>
            {g.values.map((_v, si) => {
              const h = heights[si] ?? 0;
              const y = (tops[si] ?? base) - h;
              const color = inProgress ? "var(--text-muted)" : (series[si]?.color ?? SLOTS[si % SLOTS.length]);
              return <rect key={si} x={x} y={y} width={barW} height={Math.max(h, 0)} rx="var(--bar-radius)" fill={color} />;
            })}
            <text x={gi * slot + slot / 2} y={height - 4} fontSize="9" fill="var(--text-muted)" textAnchor="middle" fontFamily="var(--font-sans)">
              {g.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
