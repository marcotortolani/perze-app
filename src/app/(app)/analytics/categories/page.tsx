"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppHeader, Donut, SeriesLegend, Skeleton } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCategories } from "@/hooks/use-categories";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { previousClosedPeriodBounds } from "@/lib/analytics/history";
import { formatAmountCompact } from "@/lib/money/format";
import { money } from "@/lib/money/money";

/** H2 — categorías, composición del último período cerrado (Donut, LIB-06 — reemplaza el treemap del diseño original). */
export default function CategoriesAnalyticsPage() {
  const t = useTranslations();
  const router = useRouter();
  const categoryLabel = useCategoryLabel();
  const { data: household } = useCurrentHousehold();
  const { data: categories } = useCategories(household?.id);
  const { data: transactions } = useTransactions(household?.id);

  const slices = useMemo(() => {
    if (!household || !categories || !transactions) return [];
    const { start, end } = previousClosedPeriodBounds(household.periodStartDay || 1, new Date());
    const byCategory = new Map<string, bigint>();
    for (const tx of transactions) {
      if (tx.kind !== "expense" || tx.amountBase === null || !tx.categoryId) continue;
      const occurred = new Date(tx.occurredAt);
      if (occurred < start || occurred >= end) continue;
      byCategory.set(tx.categoryId, (byCategory.get(tx.categoryId) ?? 0n) + tx.amountBase);
    }
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const sorted = [...byCategory.entries()]
      .sort((a, b) => (b[1] > a[1] ? 1 : -1))
      .map(([categoryId, total]) => {
        const category = categoryById.get(categoryId);
        return { label: category ? categoryLabel(category) : categoryId, value: Number(total), total };
      });

    // La paleta de datos es de 5 slots + "Otros" (docs/02-design-system.md
    // § 2.6) — nunca un sexto slot con su propio color.
    if (sorted.length <= 5) return sorted;
    const top5 = sorted.slice(0, 5);
    const restTotal = sorted.slice(5).reduce((s, x) => s + x.total, 0n);
    return [...top5, { label: t("categoriesAnalyticsPage.other"), value: Number(restTotal), total: restTotal }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household, categories, transactions]);

  if (!household || !categories || !transactions) return <Skeleton height={300} style={{ marginTop: 16 }} />;

  const grandTotal = slices.reduce((s, x) => s + x.total, 0n);
  const baseCurrency = household.baseCurrency;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("categoriesAnalyticsPage.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
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
