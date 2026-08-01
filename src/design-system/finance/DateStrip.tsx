"use client";

import { useRef } from "react";
import type { CSSProperties } from "react";
import { useLocale } from "next-intl";
import { formatWeekdayNarrow, type Locale } from "@/i18n/formatting";

export interface DateStripDay {
  /** ISO date, p. ej. "2026-07-24". */
  date: string;
  /** Reemplaza la letra del día de semana — usar para "Hoy" / "Ayer". */
  label?: string | undefined;
}

export interface DateStripProps {
  days: (string | DateStripDay)[];
  value?: string | undefined;
  onChange?: ((date: string) => void) | undefined;
  /** Long-press abre el calendario completo. */
  onLongPress?: ((date: string) => void) | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Tira horizontal de días con snap para fechar un movimiento. El día
 * SELECCIONADO es superficie 3 con la cifra en tinta primaria peso 600;
 * HOY (y ayer) se nombra en palabras, en tinta primaria. La selección
 * nunca usa relleno de marca.
 */
export function DateStrip({ days = [], value, onChange, onLongPress, style }: DateStripProps) {
  const locale = useLocale() as Locale;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollSnapType: "x mandatory", scrollbarWidth: "none", ...style }}>
      {days.map((d) => {
        const iso = typeof d === "string" ? d : d.date;
        const named = typeof d === "object" ? d.label : undefined;
        const dt = new Date(`${iso}T00:00:00`);
        const on = iso === value;
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onChange?.(iso)}
            onPointerDown={() => {
              timer.current = setTimeout(() => onLongPress?.(iso), 500);
            }}
            onPointerUp={() => clearTimeout(timer.current)}
            onPointerLeave={() => clearTimeout(timer.current)}
            style={{
              scrollSnapAlign: "center",
              flex: "0 0 auto",
              minWidth: 52,
              height: 64,
              borderRadius: "var(--radius-input)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              cursor: "pointer",
              background: on ? "var(--selection-surface)" : "var(--surface-2)",
              boxShadow: on ? "inset 0 0 0 1px var(--selection-ring)" : "none",
              border: 0,
              color: "var(--text-secondary)",
              transition: "background var(--duration-fast) var(--ease-spring-snappy)",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: named ? 600 : 500,
                letterSpacing: ".04em",
                textTransform: "uppercase",
                color: named ? "var(--text-primary)" : on ? "var(--text-secondary)" : "var(--text-muted)",
              }}
            >
              {named ?? formatWeekdayNarrow(locale, dt)}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontVariantNumeric: "tabular-nums",
                fontSize: 17,
                fontWeight: on ? 600 : 500,
                color: on ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              {dt.getDate()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
