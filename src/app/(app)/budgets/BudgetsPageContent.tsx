"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Amount, BudgetRing, Card, EmptyState, ListRow, NeedsFxBanner, SkeletonRow, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useBudgets } from "@/hooks/use-budgets";
import { useCategories } from "@/hooks/use-categories";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { currentPeriodBounds } from "@/lib/analytics/history";
import { computeBudgetProgress } from "@/lib/analytics/budget-progress";
import { money } from "@/lib/money/money";

/** F1 — presupuestos: progreso de cada uno en el período en curso. Separado de `page.tsx` para que `<ModuleGate>` pueda diferirlo con `next/dynamic` (C15/C16) — sin esto, los hooks de datos de acá corrían aunque el módulo estuviera apagado. */
export default function BudgetsPageContent() {
  const t = useTranslations();
  usePageHeader({ title: t("nav.budgets") });
  const router = useRouter();
  const categoryLabel = useCategoryLabel();
  const { data: household } = useCurrentHousehold();
  const { data: budgets } = useBudgets(household?.id);
  const { data: categories } = useCategories(household?.id);
  const { data: transactions } = useTransactions(household?.id);

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
  const excludedTotal = budgets.reduce((sum, b) => sum + computeBudgetProgress(b, transactions, start, end, categories).excludedCount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8, paddingBottom: 24 }}>
      {excludedTotal > 0 ? <NeedsFxBanner count={excludedTotal} onResolve={() => router.push("/accounts/resolve-fx")} style={{ margin: "0 calc(-1 * var(--screen-padding))", borderRadius: 0 }} /> : null}
      <ListRow icon="plus" label={t("budgetsPage.newBudget")} variant="action" onClick={() => router.push("/budgets/new")} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {budgets.map((budget) => {
          const progress = computeBudgetProgress(budget, transactions, start, end, categories);
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
