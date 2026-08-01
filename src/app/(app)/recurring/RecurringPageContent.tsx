"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Amount, EmptyState, ListRow, SkeletonRow, StatTile } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useRecurringRules } from "@/hooks/use-recurring-rules";
import { useTransactions } from "@/hooks/use-transactions";
import { computeMonthlyCommitted } from "@/lib/analytics/recurring-schedule";
import { formatAmountCompact } from "@/lib/money/format";
import { money } from "@/lib/money/money";

/** G2 — recurrentes: la plantilla y si ya se cargó el mes en curso. Separado de `page.tsx` — ver el comentario en `budgets/BudgetsPageContent.tsx`. */
export default function RecurringPageContent() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: rules } = useRecurringRules(household?.id);
  const { data: transactions } = useTransactions(household?.id);

  if (!household || !rules || !transactions) {
    return (
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (rules.length === 0) {
    return <EmptyState message={t("recurringPage.empty")} actionLabel={t("recurringPage.emptyAction")} onAction={() => router.push("/recurring/new")} />;
  }

  const now = new Date();
  const chargedThisMonth = new Set(
    transactions.filter((tx) => tx.recurringId && new Date(tx.occurredAt).getMonth() === now.getMonth() && new Date(tx.occurredAt).getFullYear() === now.getFullYear()).map((tx) => tx.recurringId)
  );
  const committed = computeMonthlyCommitted(rules);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 8, paddingBottom: 24 }}>
      <StatTile label={t("recurringPage.committedPerMonth")} value={formatAmountCompact(money(committed, household.baseCurrency), { showSign: false })} style={{ marginBottom: 12 }} />
      <ListRow icon="calendar" label={t("recurringPage.viewCalendar")} onClick={() => router.push("/recurring/calendar")} />
      <ListRow icon="plus" label={t("recurringPage.newRule")} variant="action" onClick={() => router.push("/recurring/new")} />
      {rules.map((rule) => (
        <ListRow
          key={rule.id}
          label={rule.name}
          meta={t("recurringPage.dayOfMonth", { day: rule.dayOfMonth })}
          variant="value"
          onClick={() => router.push(`/recurring/${rule.id}`)}
          value={
            <div style={{ textAlign: "right" }}>
              <Amount value={money(rule.expectedAmount, rule.currencyCode)} size="body" showSign={false} polarity="neutral" tabular />
              <div style={{ fontSize: 12, color: chargedThisMonth.has(rule.id) ? "var(--good)" : "var(--text-muted)", marginTop: 2 }}>
                {chargedThisMonth.has(rule.id) ? t("recurringPage.chargedThisMonth") : t("recurringPage.notYetChargedThisMonth")}
              </div>
            </div>
          }
        />
      ))}
    </div>
  );
}
