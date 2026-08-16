"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { ErrorState, NeedsFxBanner, Skeleton, usePageHeader } from "@/design-system";
import { SeriesLegend } from "@/design-system/charts";

// C15/auditoría — ver el mismo comentario en `analytics/trends/page.tsx`.
const Donut = dynamic(() => import("@/design-system/charts/Donut").then((m) => m.Donut), { ssr: false });
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategoryDirectory, useKnownCategoryIds } from "@/hooks/use-category-directory";
import { useQueryErrorState } from "@/hooks/use-query-error-state";
import { previousClosedPeriodBounds } from "@/lib/analytics/history";
import { expenseByCategory } from "@/lib/analytics/period-summary";
import { formatAmountCompact } from "@/lib/money/format";
import { money } from "@/lib/money/money";

/** H2 — categorías, composición del último período cerrado (Donut, LIB-06 — reemplaza el treemap del diseño original). */
export default function CategoriesAnalyticsPage() {
  const t = useTranslations();
  const router = useRouter();
  usePageHeader({ title: t("categoriesAnalyticsPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });
  const { data: household } = useCurrentHousehold();
  const transactionsQuery = useTransactions(household?.id);
  const { data: transactions } = transactionsQuery;
  const categoryLabel = useCategoryDirectory(household?.id);
  const knownCategoryIds = useKnownCategoryIds(household?.id);

  const { slices, excludedCount } = useMemo(() => {
    if (!household || !transactions) return { slices: [], excludedCount: 0 };
    const { start, end } = previousClosedPeriodBounds(household.periodStartDay || 1, new Date());
    // El agrupado por categoría vive en `lib/analytics/period-summary.ts`:
    // el resumen mensual por mail necesita exactamente lo mismo, y copiarlo
    // es cómo la regla de signo por `kind` terminó reimplementada doce veces
    // (tres con el signo mal). Acá queda solo la presentación.
    const { categories: ranked, excludedCount: exCount } = expenseByCategory(transactions, start, end);
    // Un `categoryId` sin fila real (`useKnownCategoryIds`) es una
    // referencia rota, no una categoría — se funde en "Otros" en vez de
    // ocupar uno de los 5 slots de la paleta.
    const known = ranked.filter((c) => knownCategoryIds.has(c.categoryId));
    const unresolvedTotal = ranked.filter((c) => !knownCategoryIds.has(c.categoryId)).reduce((s, c) => s + c.total, 0n);
    const sorted = known.map(({ categoryId, total }) => ({ label: categoryLabel(categoryId), value: Number(total), total }));

    // La paleta de datos es de 5 slots + "Otros" (docs/02-design-system.md
    // § 2.6) — nunca un sexto slot con su propio color.
    if (sorted.length <= 5 && unresolvedTotal === 0n) return { slices: sorted, excludedCount: exCount };
    const top5 = sorted.slice(0, 5);
    const restTotal = sorted.slice(5).reduce((s, x) => s + x.total, 0n) + unresolvedTotal;
    return { slices: [...top5, { label: t("categoriesAnalyticsPage.other"), value: Number(restTotal), total: restTotal }], excludedCount: exCount };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household, transactions, knownCategoryIds]);

  const errorState = useQueryErrorState(transactionsQuery, { what: t("categoriesAnalyticsPage.loadError") });
  if (errorState) return <ErrorState {...errorState} />;

  if (!household || !transactions) return <Skeleton height={300} style={{ marginTop: 16 }} />;

  const grandTotal = slices.reduce((s, x) => s + x.total, 0n);
  const baseCurrency = household.baseCurrency;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <NeedsFxBanner
        count={excludedCount}
        onResolve={() => router.push("/accounts/resolve-fx")}
        style={{ margin: "0 calc(-1 * var(--screen-padding))", borderRadius: 0 }}
      />
      <div style={{ paddingTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <Donut slices={slices} dimension={formatAmountCompact(money(grandTotal, baseCurrency), { showSign: false })} />
        <SeriesLegend
          style={{ width: "100%" }}
          series={slices.map((s) => ({ label: s.label, value: formatAmountCompact(money(s.total, baseCurrency), { showSign: false }) }))}
        />
      </div>
    </div>
  );
}
