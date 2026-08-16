"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Amount, Card, EmptyState, ErrorState, ListRow, ProgressBar, SkeletonRow, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useGoals } from "@/hooks/use-goals";
import { useAccounts } from "@/hooks/use-accounts";
import { useQueryErrorState } from "@/hooks/use-query-error-state";
import { money } from "@/lib/money/money";

/** F5 — metas: progreso de cada una, medido por el saldo de la cuenta que la respalda. Separado de `page.tsx` — ver el comentario en `budgets/BudgetsPageContent.tsx`. */
export default function GoalsPageContent() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const goalsQuery = useGoals(household?.id);
  const accountsQuery = useAccounts(household?.id);
  const { data: goals } = goalsQuery;
  const { data: accounts } = accountsQuery;
  usePageHeader({ title: t("morePage.goals"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  const errorState = useQueryErrorState(goalsQuery.isError ? goalsQuery : accountsQuery, { what: t("goalsPage.loadError") });
  if (errorState) return <ErrorState {...errorState} />;

  if (!household || !goals || !accounts) {
    return (
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (goals.length === 0) {
    return <EmptyState message={t("goalsPage.empty")} actionLabel={t("goalsPage.emptyAction")} onAction={() => router.push("/goals/new")} />;
  }

  const accountById = new Map(accounts.map((a) => [a.id, a]));

  return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8, paddingBottom: 24 }}>
        <ListRow icon="plus" label={t("goalsPage.newGoal")} variant="action" onClick={() => router.push("/goals/new")} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {goals.map((goal) => {
          const account = goal.accountId ? accountById.get(goal.accountId) : undefined;
          const saved = account ? account.currentBalance : 0n;
          const progress = goal.targetAmount > 0n ? Math.min(1, Number(saved) / Number(goal.targetAmount)) : 0;
          return (
            <Card key={goal.id} padding={16} style={{ cursor: "pointer" }}>
              <button type="button" onClick={() => router.push(`/goals/${goal.id}`)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 16, color: "var(--text-primary)" }}>{goal.name}</span>
                  <Amount value={money(saved, goal.currencyCode)} size="label" showSign={false} polarity="neutral" tabular />
                </div>
                <ProgressBar value={progress} style={{ marginTop: 10 }} />
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                  {t("goalsPage.ofTarget", { percent: Math.round(progress * 100) })}
                </div>
              </button>
            </Card>
          );
        })}
        </div>
      </div>
  );
}
