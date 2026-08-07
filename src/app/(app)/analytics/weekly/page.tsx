"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { EmptyState, NeedsFxBanner, Skeleton, StatTile, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCategories } from "@/hooks/use-categories";
import { usePayees } from "@/hooks/use-payees";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { computeWeeklySummary } from "@/lib/analytics/weekly-summary";
import { weekdayAnchors } from "@/features/movements/calendar-scope";
import { useWeekStartsOn } from "@/stores/format-preferences-store";
import { formatAmountCompact } from "@/lib/money/format";
import { formatDateShort } from "@/i18n/formatting";
import { money } from "@/lib/money/money";
import type { Locale } from "@/i18n/formatting";

/** H11 — resumen semanal: tres datos y una comparación contra la semana anterior. */
export default function WeeklySummaryPage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  usePageHeader({ title: t("weeklySummaryPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });
  const { data: household } = useCurrentHousehold();
  const { data: transactions } = useTransactions(household?.id);
  const { data: categories } = useCategories(household?.id);
  const { data: payees } = usePayees(household?.id);
  const categoryLabel = useCategoryLabel();
  const weekStartsOn = useWeekStartsOn();

  const summary = useMemo(() => {
    if (!transactions) return null;
    const now = new Date();
    const weekStart = weekdayAnchors(now, weekStartsOn)[0]!;
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const prevWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { weekStart, weekEnd, ...computeWeeklySummary(transactions, weekStart, weekEnd, prevWeekStart, weekStart) };
  }, [transactions, weekStartsOn]);

  if (!household || !transactions || !categories || !payees || !summary) return <Skeleton height={220} style={{ marginTop: 16 }} />;

  if (summary.total === 0n && summary.excludedCount === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <EmptyState message={t("weeklySummaryPage.empty")} actionLabel={t("weeklySummaryPage.emptyAction")} onAction={() => router.push("/add")} />
      </div>
    );
  }

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const payeeById = new Map(payees.map((p) => [p.id, p]));
  const baseCurrency = household.baseCurrency;

  const categoryChangeLabel = summary.biggestCategoryChange
    ? categoryLabel(categoryById.get(summary.biggestCategoryChange.categoryId) ?? { name: summary.biggestCategoryChange.categoryId, i18nKey: null, isSystem: false })
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <NeedsFxBanner count={summary.excludedCount} />
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 20 }}>
        <StatTile
          label={t("weeklySummaryPage.range", { from: formatDateShort(locale, summary.weekStart), to: formatDateShort(locale, new Date(summary.weekEnd.getTime() - 86400000)) })}
          value={formatAmountCompact(money(summary.total, baseCurrency), { showSign: false })}
        />
        {summary.mostExpensiveDay ? (
          <div>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("weeklySummaryPage.mostExpensiveDay")}</div>
            <div style={{ fontSize: 16, color: "var(--text-primary)", marginTop: 4 }}>
              {formatDateShort(locale, new Date(summary.mostExpensiveDay.dateIso))} · {formatAmountCompact(money(summary.mostExpensiveDay.total, baseCurrency), { showSign: false })}
            </div>
          </div>
        ) : null}
        {summary.topPayee ? (
          <div>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("weeklySummaryPage.topPayee")}</div>
            <div style={{ fontSize: 16, color: "var(--text-primary)", marginTop: 4 }}>
              {payeeById.get(summary.topPayee.payeeId)?.name ?? summary.topPayee.payeeId} · {t("weeklySummaryPage.visits", { count: summary.topPayee.visits })}
            </div>
          </div>
        ) : null}
        {summary.biggestCategoryChange && categoryChangeLabel ? (
          <div>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("weeklySummaryPage.biggestChange")}</div>
            <div style={{ fontSize: 16, color: "var(--text-primary)", marginTop: 4 }}>
              {categoryChangeLabel} · {formatAmountCompact(money(summary.biggestCategoryChange.delta, baseCurrency), { showSign: true })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
