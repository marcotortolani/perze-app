"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { EmptyState, NeedsFxBanner } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategoryDirectory, useKnownCategoryIds } from "@/hooks/use-category-directory";
import { currentPeriodBounds, previousClosedPeriodBounds } from "@/lib/analytics/history";
import { expenseByCategory } from "@/lib/analytics/period-summary";
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
  const { data: transactions } = useTransactions(household?.id);
  const categoryLabel = useCategoryDirectory(household?.id);
  const knownCategoryIds = useKnownCategoryIds(household?.id);

  // Mismo criterio que `/analytics/categories` (Donut) y mismo cálculo:
  // `expenseByCategory` (`lib/analytics/period-summary.ts`) es la única
  // implementación de "gasto por categoría, consumo puro, needs_fx afuera"
  // — reimplementarla acá inline fue como una compra de instrumento con
  // categoría archivada terminó mostrando su UUID en vez de "Otros". Top 5
  // + "Otros" sigue siendo presentación local (docs/02-design-system.md §
  // 2.6, nunca un sexto slot de color propio). A diferencia de esa
  // pantalla, este es un widget secundario, no la vista de tendencia de
  // categorías: si el período cerrado todavía no tiene gasto categorizado
  // (cuenta nueva, o todo lo cargado cae en el mes en curso, como en la
  // captura de prueba), cae al período EN CURSO — mismo criterio que ya usa
  // `budgets` para leer mientras el mes corre — antes que dejar el panel
  // vacío.
  const { radarData, isCurrentPeriod, excludedCount } = useMemo(() => {
    const empty = { radarData: [] as { label: string; value: number; formatted: string }[], isCurrentPeriod: false, excludedCount: 0 };
    if (!household || !transactions) return empty;

    const breakdown = (start: Date, end: Date) => {
      const { categories: ranked, excludedCount: excluded } = expenseByCategory(transactions, start, end);
      // Un `categoryId` que no resuelve a ninguna fila (`useKnownCategoryIds`)
      // no es una categoría con la que el usuario se identifique — es una
      // referencia rota, no una elección de "sin categoría". No compite por
      // un vértice propio: se funde en "Otros" igual que el resto que no
      // entra en el top 5.
      const known = ranked.filter((c) => knownCategoryIds.has(c.categoryId));
      const unresolvedTotal = ranked.filter((c) => !knownCategoryIds.has(c.categoryId)).reduce((s, c) => s + c.total, 0n);
      const top5 = known.slice(0, 5);
      const rest = known.slice(5).reduce((s, c) => s + c.total, 0n) + unresolvedTotal;
      const entries = rest > 0n ? [...top5, { categoryId: "__other", total: rest }] : top5;
      const radarData = entries.map(({ categoryId, total }) => {
        const label = categoryId === "__other" ? t("categoriesAnalyticsPage.other") : categoryLabel(categoryId);
        return { label, value: Number(total), formatted: formatAmountCompact(money(total, household.baseCurrency), { showSign: false }) };
      });
      return { radarData, excludedCount: excluded };
    };

    const now = new Date();
    const closed = previousClosedPeriodBounds(household.periodStartDay || 1, now);
    const fromClosed = breakdown(closed.start, closed.end);
    if (fromClosed.radarData.length >= 3) return { ...fromClosed, isCurrentPeriod: false };

    const current = currentPeriodBounds(household.periodStartDay || 1, now);
    return { ...breakdown(current.start, current.end), isCurrentPeriod: true };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household, transactions, knownCategoryIds]);

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
          {excludedCount > 0 ? <NeedsFxBanner count={excludedCount} style={{ marginTop: 12, justifyContent: "center", padding: "10px 0" }} /> : null}
          <div style={{ marginTop: 12 }}>
            <CategoryRadarChart data={radarData} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
