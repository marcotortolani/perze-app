"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Amount, EmptyState, ListRow, NeedsFxBanner, Sheet, Skeleton } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useTransactionYearRange } from "@/hooks/use-transactions";
import { useScopedTransactions } from "@/hooks/use-scoped-transactions";
import { dayKeyOf, localMidnightIso, monthOfDay } from "@/features/movements/calendar-scope";
import { add, money, subtract, zero } from "@/lib/money/money";
import { classifyCashFlow } from "@/lib/analytics/cash-flow";
import { formatMonthName, type Locale } from "@/i18n/formatting";

/** Techo compartido con `TransactionsMonthCalendar` — las dos vistas ocupan la misma columna. */
const PANEL_MAX_WIDTH = 480;

/**
 * Mismo valor y misma técnica que `SELECTION_BLEED` en
 * `TransactionsListContent.tsx`: el resalte de la fila elegida tiene que
 * sangrar hacia afuera del ancho de la fila (`ListRow` no tiene padding
 * horizontal propio), no quedar pegado a los bordes del texto — si no, se ve
 * como una franja plana en vez del mismo "chip flotante" con el que ya se
 * marca la selección en todos lados (la fila de movimiento activa, los días
 * del calendario). `marginInline: -BLEED` ensancha la caja del resalte;
 * `paddingInline: BLEED` empuja el contenido de vuelta a su lugar, así el
 * ícono y el texto quedan exactamente donde estarían sin selección.
 */
const SELECTION_BLEED = 12;

function monthName(locale: Locale, month1: number): string {
  return formatMonthName(locale, month1);
}

export interface TransactionsHistoryPanelProps {
  /** `"YYYY-MM"` si el rango elegido actualmente ES un mes completo, `null` si no hay nada elegido (o el rango es otra cosa — un día, un período arbitrario). */
  selectedMonth: string | null;
  onSelectMonth: (month: string) => void;
}

/**
 * D-historial — navegador año → mes, como VISTA de `/transactions` (segunda
 * columna en escritorio, contenido arriba de la lista en mobile — ver
 * `page.tsx`), no una pantalla propia.
 *
 * No reimplementa la lista: elegir un mes aplica un rango a los filtros de
 * la lista de la izquierda (`useHistoryView().selectMonth`), el mismo
 * mecanismo que ya usa el deep link de "período" del home — la lista real,
 * con toda su funcionalidad (swipe, detalle, filtros), sigue haciendo lo que
 * ya hace.
 *
 * Sin `usePageHeader`: es un panel, no una pantalla (mismo criterio que
 * `TransactionsMonthCalendar`).
 */
export function TransactionsHistoryPanel({ selectedMonth, onSelectMonth }: TransactionsHistoryPanelProps) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();

  const { data: household } = useCurrentHousehold();
  const { data: yearRange, isLoading: yearsLoading } = useTransactionYearRange(household?.id);

  // El año inicial sale del mes YA elegido (si lo hay) — con un período
  // aplicado desde afuera (el chip del home, por ejemplo) el panel tiene que
  // abrir mostrando ESE año, no el más reciente. Recién si no hay nada
  // elegido cae a `yearRange.maxYear`.
  const [pickedYear, setPickedYear] = useState<number | null>(null);
  const [yearSheetOpen, setYearSheetOpen] = useState(false);
  const year = pickedYear ?? (selectedMonth ? Number(selectedMonth.slice(0, 4)) : (yearRange?.maxYear ?? new Date().getFullYear()));
  const years = yearRange ? Array.from({ length: yearRange.maxYear - yearRange.minYear + 1 }, (_, i) => yearRange.maxYear - i) : [];

  const yearBounds = useMemo(() => ({ from: localMidnightIso(year, 0, 1), to: localMidnightIso(year + 1, 0, 1) }), [year]);
  const { data: yearTransactions = [], isLoading: txLoading } = useScopedTransactions(household?.id, yearBounds);

  const baseCurrency = household?.baseCurrency ?? "UYU";

  // Un bucket por mes — mismo criterio que el resumen de período de
  // `TransactionsListContent`: transferencias y adjustments no suman ni
  // restan, compras/ventas de instrumentos sí (`cash-flow.ts`), y un
  // movimiento sin cotización resuelta se EXCLUYE del neto (nunca se suma
  // como si valiera cero) pero sí cuenta para el conteo del mes.
  const { months, excludedCount } = useMemo(() => {
    const byMonth = new Map<number, { count: number; net: ReturnType<typeof money> }>();
    for (let m = 1; m <= 12; m++) byMonth.set(m, { count: 0, net: zero(baseCurrency) });
    let excluded = 0;
    for (const tx of yearTransactions) {
      if (tx.deletedAt !== null) continue;
      const monthKey = monthOfDay(dayKeyOf(tx.occurredAt));
      const monthIndex = Number(monthKey.slice(5, 7));
      const bucket = byMonth.get(monthIndex);
      if (!bucket) continue;
      bucket.count += 1;
      const flow = classifyCashFlow(tx);
      if (flow.bucket === "needsFx") {
        excluded += 1;
        continue;
      }
      const amt = money(flow.magnitude, baseCurrency);
      if (flow.bucket === "inflow") bucket.net = add(bucket.net, amt);
      else if (flow.bucket === "outflow") bucket.net = subtract(bucket.net, amt);
    }
    return { months: byMonth, excludedCount: excluded };
  }, [yearTransactions, baseCurrency]);

  if (!household || yearsLoading) {
    return <Skeleton height={260} style={{ maxWidth: PANEL_MAX_WIDTH, marginInline: "auto" }} />;
  }

  if (!yearRange) {
    return <EmptyState message={t("transactions.history.empty")} />;
  }

  return (
    <div className="w-full" style={{ maxWidth: PANEL_MAX_WIDTH, marginInline: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <button
        type="button"
        onClick={() => setYearSheetOpen(true)}
        className="rounded-card border-0 bg-surface-2 p-3.5 text-left cursor-pointer"
      >
        <div className="t-caption text-text-muted">{t("transactions.history.year")}</div>
        <div className="mt-0.5 text-[15px] text-text-primary">{year}</div>
      </button>

      <NeedsFxBanner count={excludedCount} onResolve={() => router.push("/accounts/resolve-fx")} />

      <div className="flex flex-col">
        {!txLoading
          ? Array.from({ length: 12 }, (_, i) => i + 1).map((monthIndex) => {
              const bucket = months.get(monthIndex)!;
              const hasData = bucket.count > 0;
              const monthKey = `${year}-${String(monthIndex).padStart(2, "0")}`;
              const isSelected = monthKey === selectedMonth;
              return (
                <div
                  key={monthIndex}
                  style={
                    isSelected
                      ? {
                          background: "var(--selection-surface)",
                          boxShadow: "inset 0 0 0 1px var(--selection-ring)",
                          borderRadius: "var(--radius-card)",
                          marginInline: -SELECTION_BLEED,
                          paddingInline: SELECTION_BLEED,
                        }
                      : undefined
                  }
                >
                  <ListRow
                    icon="calendar"
                    label={monthName(locale, monthIndex)}
                    meta={t("transactions.list.dayCount", { count: bucket.count })}
                    variant="value"
                    disabled={!hasData}
                    onClick={hasData ? () => onSelectMonth(monthKey) : undefined}
                    value={hasData ? <Amount value={bucket.net} size="body" polarity={bucket.net.amount >= 0n ? "positive" : "negative"} tabular /> : undefined}
                  />
                </div>
              );
            })
          : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={56} style={{ marginBottom: 4 }} />)}
      </div>

      <Sheet open={yearSheetOpen} title={t("transactions.history.chooseYear")} onClose={() => setYearSheetOpen(false)}>
        <div className="flex flex-col">
          {years.map((y) => (
            <ListRow
              key={y}
              label={String(y)}
              onClick={() => {
                setPickedYear(y);
                setYearSheetOpen(false);
              }}
            />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
