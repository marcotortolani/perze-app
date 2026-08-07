"use client";

import { useMemo, type CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/design-system";
import { formatDateLong, formatMonthYearHeading, formatWeekdayNarrow, type Locale } from "@/i18n/formatting";
import { money } from "@/lib/money/money";
import { formatAmountCompact } from "@/lib/money/format";
import { todayIso } from "@/lib/dates/today";
import { expenseTotalsByDay, heatMixPercent, isFutureDay, monthGrid, noonUtc, shiftMonth, weekdayAnchors } from "@/features/movements/calendar-scope";
import { useWeekStartsOn } from "@/stores/format-preferences-store";
import type { TransactionRow as TransactionRecord } from "@/lib/db/schema";

/**
 * D5 — la grilla del mes, con la intensidad de gasto por día codificada en
 * color.
 *
 * **Es presentacional y no tiene estado.** Ni el mes ni el día elegido viven
 * acá: los dos salen de los search params `from`/`to` de `/transactions` (ver
 * `features/movements/calendar-scope.ts`), así que el calendario no puede
 * desincronizarse de lo que la lista está mostrando. Tampoco trae hooks de
 * datos: las transacciones llegan por prop, ya filtradas por todo MENOS la
 * fecha — si el heatmap se calculara sobre la lista ya filtrada por día, elegir
 * un día apagaría el resto del mes y la visualización se borraría a sí misma.
 *
 * **Sin `usePageHeader`.** El header lo registra la lista (`"Movimientos"`) y,
 * cuando hay un movimiento abierto, el `DetailHeaderBridge` de `page.tsx`.
 * Mismo criterio que `RecurringMonthCalendar`, que también vive en dos hosts.
 *
 * El techo de 480px es load-bearing: las celdas son cuadradas, así que el mes
 * crece de ALTO cuando crece de ancho. Sin techo, en la columna de escritorio
 * un mes de seis filas se comería la pantalla.
 */
const CALENDAR_MAX_WIDTH = 480;

export interface TransactionsMonthCalendarProps {
  /** `"YYYY-MM"`. */
  month: string;
  /** `"YYYY-MM-DD"` o `null` si el alcance es el mes entero. */
  selectedDay: string | null;
  /** Ya filtradas por todos los filtros activos MENOS el rango de fecha. */
  transactions: TransactionRecord[];
  baseCurrency: string;
  onMonthChange: (month: string) => void;
  /** `null` cuando se deselecciona el día y se vuelve al mes entero. */
  onSelectDay: (day: string | null) => void;
  style?: CSSProperties;
}

export function TransactionsMonthCalendar({
  month,
  selectedDay,
  transactions,
  baseCurrency,
  onMonthChange,
  onSelectDay,
  style,
}: TransactionsMonthCalendarProps) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const weekStartsOn = useWeekStartsOn();

  const totalsByDay = useMemo(() => expenseTotalsByDay(transactions), [transactions]);
  const cells = useMemo(() => monthGrid(month, { weekStartsOn }), [month, weekStartsOn]);
  const today = todayIso();

  // El máximo del MES visible, no de toda la historia: si se normalizara
  // contra el máximo global, un mes tranquilo se vería entero en blanco y la
  // comparación entre sus días —que es para lo que sirve el heatmap— se
  // perdería.
  const maxTotal = useMemo(() => {
    let max = 0;
    for (const [day, total] of totalsByDay) {
      if (day.slice(0, 7) !== month) continue;
      max = Math.max(max, Number(total));
    }
    return Math.max(1, max);
  }, [totalsByDay, month]);

  const dowLabels = useMemo(() => weekdayAnchors(new Date(), weekStartsOn).map((d) => formatWeekdayNarrow(locale, d)), [locale, weekStartsOn]);
  const monthHeading = formatMonthYearHeading(locale, noonUtc(`${month}-01`));

  return (
    <div className="w-full" style={{ maxWidth: CALENDAR_MAX_WIDTH, marginInline: "auto", ...style }}>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(shiftMonth(month, -1))}
          aria-label={t("transactions.calendar.prevMonth")}
          className="flex h-11 w-11 cursor-pointer items-center justify-center border-0 bg-transparent"
        >
          <Icon name="chevron-left" size={20} color="var(--text-secondary)" />
        </button>
        <span className="t-body" style={{ fontWeight: 600 }}>
          {monthHeading}
        </span>
        <button
          type="button"
          onClick={() => onMonthChange(shiftMonth(month, 1))}
          aria-label={t("transactions.calendar.nextMonth")}
          className="flex h-11 w-11 cursor-pointer items-center justify-center border-0 bg-transparent"
        >
          <Icon name="chevron" size={20} color="var(--text-secondary)" />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
        {dowLabels.map((d, i) => (
          <div key={`${d}-${i}`} style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)" }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {cells.map((iso, i) => {
          if (!iso) return <div key={`empty-${i}`} />;
          const total = totalsByDay.get(iso) ?? 0n;
          // Cuánto color le toca al día. La curva, el piso y el techo viven en
          // `calendar-scope.ts` porque son la parte testeable —y la que ya se
          // calibró mal una vez—, no una constante de estilo.
          const mixPercent = heatMixPercent(total, maxTotal);
          const isSelected = iso === selectedDay;
          const isToday = iso === today;
          // Un día futuro no puede tener movimientos, así que elegirlo es una
          // interacción sin salida: siempre devuelve una lista vacía. Va
          // `disabled` de verdad y no solo `cursor: default`, para que el
          // teclado también los saltee.
          const isFuture = isFutureDay(iso, today);
          const dayLabel = formatDateLong(locale, noonUtc(iso));
          return (
            <button
              key={iso}
              type="button"
              disabled={isFuture}
              onClick={() => onSelectDay(isSelected ? null : iso)}
              aria-pressed={isSelected}
              aria-label={total > 0n ? `${dayLabel} · ${formatAmountCompact(money(total, baseCurrency), { showSign: false })}` : dayLabel}
              style={{
                aspectRatio: "1",
                borderRadius: 14,
                border: 0,
                // La selección va por superficie + anillo, el par canónico del
                // sistema. El diseño la pinta solo con relleno, pero la
                // auditoría midió eso en 1,065:1 en modo claro —
                // indistinguible — y pide este par, que es además el que ya
                // usa el resalte de fila de esta misma lista.
                background: isSelected
                  ? "var(--selection-surface)"
                  : mixPercent > 0
                    ? `color-mix(in srgb, var(--data-1) ${Math.round(mixPercent)}%, var(--surface-1))`
                    : "var(--surface-1)",
                boxShadow: isSelected
                  ? "inset 0 0 0 1px var(--selection-ring)"
                  : isToday
                    ? "inset 0 0 0 1px var(--primary-ink)"
                    : undefined,
                color: "var(--text-primary)",
                fontFamily: "var(--font-mono)",
                fontVariantNumeric: "tabular-nums",
                fontSize: 13,
                fontWeight: isSelected ? 600 : 400,
                opacity: isFuture ? 0.4 : 1,
                cursor: isFuture ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {Number(iso.slice(-2))}
            </button>
          );
        })}
      </div>

      {/* Leyenda de intensidad. Un heatmap sin escala no se puede leer: el
          color codifica un dato y no hay forma de saber qué significa un tono
          intermedio.

          Y nombra la métrica —"menos GASTO" / "más GASTO"— porque el color
          codifica solo gastos: los ingresos no entran. Sin eso, un día con un
          ingreso grande y sin gastos se ve vacío y parece un bug. Es el único
          lugar de la pantalla donde se puede decir de qué habla el color. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <span className="t-caption" style={{ color: "var(--text-muted)" }}>
          {t("transactions.calendar.intensityLess")}
        </span>
        <div
          aria-hidden="true"
          style={{ width: 64, height: 8, borderRadius: 4, background: "linear-gradient(90deg, var(--surface-1), var(--data-1))" }}
        />
        <span className="t-caption" style={{ color: "var(--text-muted)" }}>
          {t("transactions.calendar.intensityMore")}
        </span>
      </div>
    </div>
  );
}
