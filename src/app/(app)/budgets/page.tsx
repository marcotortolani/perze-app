"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Amount, BudgetRing, Card, EmptyState, ListRow, NeedsFxBanner, SkeletonRow } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useBudgets } from "@/hooks/use-budgets";
import { useCategories } from "@/hooks/use-categories";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { currentPeriodBounds } from "@/lib/analytics/history";
import { computeBudgetProgress } from "@/lib/analytics/budget-progress";
import { money } from "@/lib/money/money";

/** F1 — presupuestos: progreso de cada uno en el período en curso. */
export default function BudgetsPage() {
  const t = useTranslations();
  const router = useRouter();
  const categoryLabel = useCategoryLabel();
  const { data: household } = useCurrentHousehold();
  const { data: budgets } = useBudgets(household?.id);
  const { data: categories } = useCategories(household?.id);
  const { data: transactions } = useTransactions(household?.id);

  // F0: módulo apagado no se renderiza — vuelve a Home en vez de mostrar nada del módulo.
  useEffect(() => {
    if (household && !household.enabledModules.includes("budgets")) router.replace("/");
  }, [household, router]);

  if (household && !household.enabledModules.includes("budgets")) return null;

  if (!household || !budgets || !categories || !transactions) {
    return (
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (budgets.length === 0) {
    return <EmptyState message={t("budgetsPage.empty")} actionLabel={t("budgetsPage.emptyAction")} onAction={() => router.push("/budgets/new")} />;
  }

  const { start, end } = currentPeriodBounds(household.periodStartDay || 1, new Date());
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const excludedTotal = budgets.reduce((sum, b) => sum + computeBudgetProgress(b, transactions, start, end).excludedCount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8, paddingBottom: 24 }}>
      {excludedTotal > 0 ? <NeedsFxBanner count={excludedTotal} onResolve={() => router.push("/accounts/resolve-fx")} style={{ margin: "0 calc(-1 * var(--screen-padding))", borderRadius: 0 }} /> : null}
      <ListRow icon="plus" label={t("budgetsPage.newBudget")} variant="action" onClick={() => router.push("/budgets/new")} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {budgets.map((budget) => {
          const progress = computeBudgetProgress(budget, transactions, start, end);
          const category = budget.categoryId ? categoryById.get(budget.categoryId) : undefined;
          return (
            <Card key={budget.id} padding={16} style={{ cursor: "pointer" }}>
              <button type="button" onClick={() => router.push(`/budgets/${budget.id}`)} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, width: "100%" }}>
                <BudgetRing progress={progress.progress} size={56} stroke={6} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, color: "var(--text-primary)" }}>{category ? categoryLabel(category) : budget.name}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                    <Amount value={money(progress.spent, budget.currencyCode)} size="label" showSign={false} polarity="neutral" tabular /> {t("budgetsPage.of")}{" "}
                    <Amount value={money(budget.amountLimit, budget.currencyCode)} size="label" showSign={false} polarity="neutral" tabular />
                  </div>
                </div>
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
