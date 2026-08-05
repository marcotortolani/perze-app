"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Amount, Button, BudgetRing, EmptyState, NeedsFxBanner, Skeleton, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useBudgets, useInvalidateBudgets } from "@/hooks/use-budgets";
import { useCategories } from "@/hooks/use-categories";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useTransactions } from "@/hooks/use-transactions";
import { currentPeriodBounds } from "@/lib/analytics/history";
import { computeBudgetProgress } from "@/lib/analytics/budget-progress";
import { budgetsRepo } from "@/lib/repos/budgets-repo";
import { money } from "@/lib/money/money";

/**
 * F3 — detalle de un presupuesto: anillo grande + gastado/límite. El
 * anillo en 40/40 (título/label) es la excepción de jerarquía que ya
 * declaró la auditoría para esta pantalla — no "corregirla" a hero.
 */
export default function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const categoryLabel = useCategoryLabel();
  const { data: household } = useCurrentHousehold();
  const { data: budgets } = useBudgets(household?.id);
  const { data: categories } = useCategories(household?.id);
  const { data: transactions } = useTransactions(household?.id);
  const invalidateBudgets = useInvalidateBudgets(household?.id);

  const budget = budgets?.find((b) => b.id === id);
  const category = budget?.categoryId ? categories?.find((c) => c.id === budget.categoryId) : undefined;
  usePageHeader({ onBack: () => router.back(), backLabel: t("ds.appHeader.back"), ...(budget ? { title: category ? categoryLabel(category) : budget.name } : {}) });

  if (!household || !budgets || !categories || !transactions) return <Skeleton height={300} style={{ marginTop: 16 }} />;

  if (!budget) return <EmptyState message={t("budgetsPage.notFound")} actionLabel={t("budgetsPage.back")} onAction={() => router.push("/budgets")} />;
  const { start, end } = currentPeriodBounds(household.periodStartDay || 1, new Date());
  const progress = computeBudgetProgress(budget, transactions, start, end);
  const remaining = budget.amountLimit - progress.spent;

  const handleDelete = async () => {
    await budgetsRepo.archive(budget.id);
    invalidateBudgets();
    toast(t("budgetsPage.deleted"));
    // `back()`, no `replace`/`push` — la lista ya está en el historial
    // justo debajo. `replace("/budgets")` duplicaba esa misma entrada.
    router.back();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        {progress.excludedCount > 0 ? (
          <NeedsFxBanner count={progress.excludedCount} onResolve={() => router.push("/accounts/resolve-fx")} style={{ width: "100%", margin: "0 calc(-1 * var(--screen-padding))", borderRadius: 0 }} />
        ) : null}
        <BudgetRing progress={progress.progress} size={160} stroke={14} />
        <div style={{ textAlign: "center" }}>
          <Amount value={money(progress.spent, budget.currencyCode)} size="title" showSign={false} polarity="neutral" tabular />
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            {t("budgetsPage.of")} <Amount value={money(budget.amountLimit, budget.currencyCode)} size="label" showSign={false} polarity="neutral" tabular />
          </div>
          <div style={{ marginTop: 12, fontSize: 14, color: remaining >= 0n ? "var(--text-secondary)" : "var(--critical)" }}>
            {remaining >= 0n ? t("budgetsPage.remaining") : t("budgetsPage.over")}{" "}
            <Amount value={money(remaining < 0n ? -remaining : remaining, budget.currencyCode)} size="label" showSign={false} tabular />
          </div>
        </div>
        <Button variant="danger" fullWidth={false} onClick={handleDelete} style={{ marginTop: 20 }}>
          {t("budgetsPage.delete")}
        </Button>
      </div>
    </div>
  );
}
