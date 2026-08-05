"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCategories } from "@/hooks/use-categories";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { currentPeriodBounds, previousClosedPeriodBounds } from "@/lib/analytics/history";
import { formatAmountCompact } from "@/lib/money/format";
import { money } from "@/lib/money/money";

// C15/auditoría — ver el mismo comentario en `analytics/trends/page.tsx`: `recharts` no
// entra al bundle de ninguna pantalla que no lo pida.
const CategoryRadarChart = dynamic(() => import("@/design-system/charts/CategoryRadarChart").then((m) => m.CategoryRadarChart), { ssr: false });

/**
 * Columna de detalle sin movimiento seleccionado, en desktop.
 *
 * Vivía en `transactions/@detail/default.tsx` — el placeholder obligatorio del
 * slot paralelo. Ese slot ya no existe (el detalle es `?tx=`), así que esto es
 * ahora un render condicional común que el contenedor monta solo cuando hay
 * split y no hay selección; el chequeo de viewport lo hace él, no este archivo.
 */
export function TransactionsDetailEmpty() {
  const t = useTranslations();
  const { data: household } = useCurrentHousehold();
  const { data: categories } = useCategories(household?.id);
  const { data: transactions } = useTransactions(household?.id);
  const categoryLabel = useCategoryLabel();

  // Mismo criterio que `/analytics/categories` (Donut): gasto por
  // categoría del último período CERRADO, top 5 + "Otros" — nunca un sexto
  // slot de color propio (`docs/02-design-system.md` § 2.6), y los
  // movimientos sin `amountBase` (`needs_fx`) se excluyen en vez de sumar
  // como si valieran 0. A diferencia de esa pantalla, este es un widget
  // secundario, no la vista de tendencia de categorías: si el período
  // cerrado todavía no tiene gasto categorizado (cuenta nueva, o todo lo
  // cargado cae en el mes en curso, como en la captura de prueba), cae al
  // período EN CURSO — mismo criterio que ya usa `budgets` para leer
  // mientras el mes corre — antes que dejar el panel vacío.
  const { radarData, isCurrentPeriod } = useMemo(() => {
    const empty = { radarData: [] as { label: string; value: number; formatted: string }[], isCurrentPeriod: false };
    if (!household || !categories || !transactions) return empty;
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    const breakdown = (start: Date, end: Date) => {
      const byCategory = new Map<string, bigint>();
      for (const tx of transactions) {
        if (tx.kind !== "expense" || tx.amountBase === null || !tx.categoryId) continue;
        const occurred = new Date(tx.occurredAt);
        if (occurred < start || occurred >= end) continue;
        byCategory.set(tx.categoryId, (byCategory.get(tx.categoryId) ?? 0n) + tx.amountBase);
      }
      const sorted = [...byCategory.entries()].sort((a, b) => (b[1] > a[1] ? 1 : -1));
      const top5 = sorted.slice(0, 5);
      const rest = sorted.slice(5).reduce((s, [, v]) => s + v, 0n);
      const entries = rest > 0n ? [...top5, ["__other", rest] as [string, bigint]] : top5;
      return entries.map(([categoryId, total]) => {
        const category = categoryById.get(categoryId);
        const label = categoryId === "__other" ? t("categoriesAnalyticsPage.other") : category ? categoryLabel(category) : categoryId;
        return { label, value: Number(total), formatted: formatAmountCompact(money(total, household.baseCurrency), { showSign: false }) };
      });
    };

    const now = new Date();
    const closed = previousClosedPeriodBounds(household.periodStartDay || 1, now);
    const fromClosed = breakdown(closed.start, closed.end);
    if (fromClosed.length >= 3) return { radarData: fromClosed, isCurrentPeriod: false };

    const current = currentPeriodBounds(household.periodStartDay || 1, now);
    return { radarData: breakdown(current.start, current.end), isCurrentPeriod: true };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household, categories, transactions]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <EmptyState message={t("transactions.detail.selectPrompt")} />
      {/* Radar de gasto por categoría — vive acá, debajo del empty state,
          para que el panel derecho nunca quede vacío en desktop mientras
          no hay un movimiento elegido. Un mínimo de 3 categorías para que
          el polígono tenga sentido; si el período cerrado no llega, se
          omite entero en vez de mostrar un radar casi vacío. */}
      {radarData.length >= 3 ? (
        <div style={{ marginTop: 32 }}>
          <div style={{ height: 1, background: "var(--border)" }} />
          <div className="t-caption" style={{ marginTop: 24, color: "var(--text-muted)", textTransform: "uppercase", textAlign: "center" }}>
            {t(isCurrentPeriod ? "transactions.detail.categoryRadarTitleCurrent" : "transactions.detail.categoryRadarTitle")}
          </div>
          <div style={{ marginTop: 12 }}>
            <CategoryRadarChart data={radarData} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
