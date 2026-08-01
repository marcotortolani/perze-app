"use client";

import type { CSSProperties } from "react";

export interface CalendarHeatmapDay {
  /** ISO date. */
  date: string;
  /** Magnitud cruda — este componente la normaliza a 7 niveles, no recibe el nivel ya resuelto. */
  value: number;
}

export interface CalendarHeatmapProps {
  days: CalendarHeatmapDay[];
  rows?: "month" | "year" | undefined;
  onSelect?: ((date: string) => void) | undefined;
  style?: CSSProperties | undefined;
}

const CELL = 8;
const GAP = 3;
const HIT_AREA = 44;

/** LIB-05: heatmap de calendario — celdas de 8px con target de 44px por zona, rampa `--ramp-1..7`. */
export function CalendarHeatmap({ days, rows = "year", onSelect, style }: CalendarHeatmapProps) {
  const max = Math.max(...days.map((d) => d.value), 1);
  const weeks: CalendarHeatmapDay[][] = [];
  const perRow = rows === "month" ? 7 : 7;
  for (let i = 0; i < days.length; i += perRow) weeks.push(days.slice(i, i + perRow));

  return (
    <div style={{ display: "flex", gap: GAP, overflowX: "auto", ...style }}>
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
          {week.map((d) => {
            const level = d.value <= 0 ? 0 : Math.max(1, Math.min(7, Math.ceil((d.value / max) * 7)));
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => onSelect?.(d.date)}
                aria-label={d.date}
                style={{
                  width: CELL,
                  height: CELL,
                  minWidth: CELL,
                  padding: (HIT_AREA - CELL) / 2,
                  background: "none",
                  border: 0,
                  cursor: onSelect ? "pointer" : "default",
                }}
              >
                <span
                  style={{
                    display: "block",
                    width: CELL,
                    height: CELL,
                    borderRadius: 2,
                    background: level > 0 ? `var(--ramp-${level})` : "var(--surface-2)",
                  }}
                />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
