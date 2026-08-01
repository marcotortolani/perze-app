"use client";

import { useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

export interface LineChartPoint {
  /** Label del eje temporal — p. ej. "Lun 20" o una fecha ISO. */
  label: string;
  value: number;
}

/** Evita que el label de mín/máx se recorte contra el borde del viewBox cuando su punto cae cerca de un extremo. */
function edgeAnchor(x: number, width: number): "start" | "middle" | "end" {
  if (x < 24) return "start";
  if (x > width - 24) return "end";
  return "middle";
}

export interface LineChartProps {
  data: LineChartPoint[];
  width?: number | undefined;
  height?: number | undefined;
  color?: string | undefined;
  /** Formatea el valor para los labels directos (mín/máx) y el tooltip. */
  formatValue?: ((value: number) => string) | undefined;
  /** D12/auditoría — ver el mismo comentario en `BarChart.tsx`. */
  ariaLabel?: string | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Línea con eje temporal, labels directos de mínimo y máximo, y tooltip
 * táctil — E2 (evolución de saldo), E6.4 (histórico de tipo de cambio).
 * El `Sparkline` no alcanza para esto: le faltan eje, labels y tooltip,
 * que la sección 7 del design system declara obligatorios.
 */
export function LineChart({ data, width = 320, height = 140, color = "var(--data-1)", formatValue = String, ariaLabel, style }: LineChartProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const summary = ariaLabel ?? data.map((d) => `${d.label}: ${formatValue(d.value)}`).join(", ");
  const padding = { top: 20, bottom: 24, left: 4, right: 4 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const maxIdx = values.indexOf(max);
  const minIdx = values.indexOf(min);

  const points = data.map((d, i): [number, number] => [
    padding.left + (i / Math.max(data.length - 1, 1)) * plotW,
    padding.top + plotH - ((d.value - min) / span) * plotH,
  ]);
  const path = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(ratio * (data.length - 1));
    setActiveIdx(Math.max(0, Math.min(data.length - 1, idx)));
  };

  const active = activeIdx !== null ? data[activeIdx] : undefined;
  const activePoint = activeIdx !== null ? points[activeIdx] : undefined;

  return (
    <div style={{ position: "relative", ...style }}>
      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setActiveIdx(null)}
      >
        <line x1={padding.left} y1={padding.top + plotH} x2={width - padding.right} y2={padding.top + plotH} stroke="var(--gridline)" strokeWidth="1" />
        <path d={path} fill="none" stroke={color} strokeWidth="var(--line-width)" strokeLinecap="round" strokeLinejoin="round" />
        {maxIdx >= 0 && points[maxIdx] ? (
          <text
            x={points[maxIdx][0]}
            y={points[maxIdx][1] - 8}
            fontSize="10"
            fill="var(--text-secondary)"
            textAnchor={edgeAnchor(points[maxIdx][0], width)}
            fontFamily="var(--font-mono)"
          >
            {formatValue(max)}
          </text>
        ) : null}
        {minIdx >= 0 && minIdx !== maxIdx && points[minIdx] ? (
          <text
            x={points[minIdx][0]}
            y={points[minIdx][1] + 16}
            fontSize="10"
            fill="var(--text-muted)"
            textAnchor={edgeAnchor(points[minIdx][0], width)}
            fontFamily="var(--font-mono)"
          >
            {formatValue(min)}
          </text>
        ) : null}
        {activePoint ? <circle cx={activePoint[0]} cy={activePoint[1]} r="var(--marker-size)" fill={color} stroke="var(--chart-separator)" strokeWidth="2" /> : null}
      </svg>
      {active && activePoint ? (
        <div
          style={{
            position: "absolute",
            left: `${(activePoint[0] / width) * 100}%`,
            top: Math.max(0, activePoint[1] - 48),
            transform: "translateX(-50%)",
            background: "var(--surface-3)",
            color: "var(--text-primary)",
            borderRadius: "var(--radius-input)",
            padding: "6px 10px",
            fontSize: 12,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "var(--shadow-sheet)",
          }}
        >
          {active.label} · {formatValue(active.value)}
        </div>
      ) : null}
    </div>
  );
}
