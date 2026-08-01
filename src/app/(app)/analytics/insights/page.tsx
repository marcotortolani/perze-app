"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader, Card, EmptyState, Skeleton } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useBudgets } from "@/hooks/use-budgets";
import { useCategories } from "@/hooks/use-categories";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { currentPeriodBounds } from "@/lib/analytics/history";
import { computeBudgetProgress } from "@/lib/analytics/budget-progress";
import { computeBudgetPaceInsights, computeLoggingStreak } from "@/lib/analytics/insights";
import { formatDateShort } from "@/i18n/formatting";
import type { Locale } from "@/i18n/formatting";

/** H10 — insights automáticos: racha de registro + ritmo de presupuesto proyectado (subconjunto del motor de reglas, ver `lib/analytics/insights.ts`). */
export default function InsightsPage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: transactions } = useTransactions(household?.id);
  const { data: budgets } = useBudgets(household?.id);
  const { data: categories } = useCategories(household?.id);
  const categoryLabel = useCategoryLabel();

  const insights = useMemo(() => {
    if (!household || !transactions || !budgets || !categories) return null;
    const now = new Date();
    const streak = computeLoggingStreak(transactions, now);
    const { start, end } = currentPeriodBounds(household.periodStartDay || 1, now);
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const activeBudgets = budgets.filter((b) => !b.archivedAt);
    const paceInputs = activeBudgets.map((b) => {
      const progress = computeBudgetProgress({ categoryId: b.categoryId, amountLimit: b.amountLimit }, transactions, start, end);
      return { categoryId: b.categoryId, amountLimit: b.amountLimit, spent: progress.spent };
    });
    const pace = computeBudgetPaceInsights(paceInputs, start, end, now);
    return {
      streak,
      pace: pace.map((p) => ({
        label: p.categoryId ? categoryLabel(categoryById.get(p.categoryId) ?? { name: p.categoryId, i18nKey: null }) : t("insightsPage.wholeHousehold"),
        date: p.projectedOverspendDate,
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household, transactions, budgets, categories]);

  if (!household || !transactions || !budgets || !categories || !insights) return <Skeleton height={220} style={{ marginTop: 16 }} />;

  const hasAny = insights.streak >= 2 || insights.pace.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("insightsPage.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {!hasAny ? <EmptyState message={t("insightsPage.empty")} /> : null}
        {insights.streak >= 2 ? (
          <Card padding={16}>
            <div style={{ fontSize: 16, color: "var(--text-primary)" }}>{t("insightsPage.streak", { days: insights.streak })}</div>
          </Card>
        ) : null}
        {insights.pace.map((p, i) => (
          <Card key={i} padding={16} style={{ cursor: "pointer" }}>
            <button type="button" onClick={() => router.push("/budgets")} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}>
              <div style={{ fontSize: 16, color: "var(--text-primary)" }}>{t("insightsPage.budgetPace", { category: p.label, date: formatDateShort(locale, p.date) })}</div>
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
