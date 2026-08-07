"use client";

import { useLocale } from "next-intl";
import type { CSSProperties } from "react";
import { formatWeekdayNarrow, type Locale } from "@/i18n/formatting";

export interface MonthCalendarMark {
  /** ISO date, p. ej. "2026-07-24". */
  date: string;
  /** 0-7, índice en `--ramp-1..7`; 0 = sin marca. */
  level: number;
}

export interface MonthCalendarProps {
  /** ISO "YYYY-MM". */
  month: string;
  marks?: MonthCalendarMark[] | undefined;
  value?: string | undefined;
  onSelect?: ((date: string) => void) | undefined;
  /** `Date.getDay()` — 0 = domingo, 1 = lunes. Nunca hardcodeado acá: viene de `useWeekStartsOn()` (Ajustes → Formato). */
  weekStartsOn: 0 | 1;
  style?: CSSProperties | undefined;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** LIB-04: grilla de mes con celdas de 44px — presupuestos (G1) y calendario de movimientos (D5). */
export function MonthCalendar({ month, marks = [], value, onSelect, weekStartsOn, style }: MonthCalendarProps) {
  const locale = useLocale() as Locale;
  const [yStr, mStr] = month.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const leadingBlanks = (first.getDay() - weekStartsOn + 7) % 7;
  const levelByDate = new Map(marks.map((mk) => [mk.date, mk.level]));

  // Enero 2024 arranca un lunes (1/1/2024) — `+7` corre el ancla a la
  // segunda semana del mes para no pisar el primer día del año, `+weekStartsOn`
  // desliza el punto de partida entre lunes (1) y domingo (0).
  const weekdayLabels = Array.from({ length: 7 }, (_, i) => formatWeekdayNarrow(locale, new Date(2024, 0, weekStartsOn + i + 7)));

  const cells: (string | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`)];

  return (
    <div style={style}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
        {weekdayLabels.map((w, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)" }}>
            {w}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((iso, i) => {
          if (!iso) return <span key={`b${i}`} style={{ minHeight: 44 }} />;
          const level = levelByDate.get(iso) ?? 0;
          const selected = iso === value;
          const day = Number(iso.slice(-2));
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect?.(iso)}
              style={{
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: level > 0 ? `var(--ramp-${Math.min(7, level)})` : "transparent",
                borderRadius: 10,
                border: 0,
                boxShadow: selected ? "inset 0 0 0 2px var(--selection-ring)" : "none",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontVariantNumeric: "tabular-nums",
                fontSize: 14,
                color: level >= 5 ? "#ffffff" : "var(--text-primary)",
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
