"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart as RechartsRadarChart, ResponsiveContainer, Tooltip } from "recharts";
import type { CSSProperties } from "react";

export interface CategoryRadarDatum {
  label: string;
  value: number;
  /** Valor ya formateado (`formatAmountCompact`) — el tooltip nunca formatea plata a mano. */
  formatted: string;
}

export interface CategoryRadarChartProps {
  data: CategoryRadarDatum[];
  height?: number | undefined;
  color?: string | undefined;
  style?: CSSProperties | undefined;
}

function RadarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CategoryRadarDatum }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]!.payload;
  return (
    <div
      style={{
        background: "var(--surface-3)",
        color: "var(--text-primary)",
        borderRadius: "var(--radius-input)",
        padding: "6px 10px",
        fontSize: 12,
        whiteSpace: "nowrap",
        boxShadow: "var(--shadow-sheet)",
      }}
    >
      {point.label} · {point.formatted}
    </div>
  );
}

/**
 * Radar de un solo eje de datos (gasto por categoría, período cerrado) —
 * usa `recharts` en vez del SVG a mano del resto de `charts/`: es el único
 * primitivo del sistema que lo hace, a propósito, porque un polígono
 * radial con N ejes (N ≥ 3, variable) no vale la pena reimplementar y
 * `recharts` ya lo resuelve bien. Estilo, color y grilla se pisan
 * completo con los tokens del sistema — nada del look default de
 * `recharts` queda visible: grilla hairline, un solo color de marca
 * (`--data-1`) y texto en tokens de tinta, nunca en el color de la serie
 * (misma regla que el resto de `docs/02-design-system.md` § 7).
 */
export function CategoryRadarChart({ data, height = 240, color = "var(--data-1)", style }: CategoryRadarChartProps) {
  const summary = data.map((d) => `${d.label}: ${d.formatted}`).join(", ");
  return (
    <div role="img" aria-label={summary} style={{ width: "100%", height, ...style }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart data={data} outerRadius="70%">
          <PolarGrid stroke="var(--gridline)" />
          <PolarAngleAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-sans)" }} />
          <Radar dataKey="value" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.22} isAnimationActive={false} />
          <Tooltip content={<RadarTooltip />} />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
