"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { EmptyState, ErrorState, NeedsFxBanner, Skeleton, usePageHeader } from "@/design-system";

// C15/auditoría — ver el mismo comentario en `analytics/trends/page.tsx`.
const Sankey = dynamic(() => import("@/design-system/charts/Sankey").then((m) => m.Sankey), { ssr: false });
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategoryDirectory } from "@/hooks/use-category-directory";
import { useQueryErrorState } from "@/hooks/use-query-error-state";
import { closedPeriodsCount, daysUntilPeriodCloses, previousClosedPeriodBounds } from "@/lib/analytics/history";
import { computeMoneyFlow } from "@/lib/analytics/money-flow";

/** H4 — flujo de dinero: Sankey ingresos → cuentas → destinos, del último período cerrado. */
export default function MoneyFlowPage() {
  const t = useTranslations();
  const router = useRouter();
  usePageHeader({ title: t("moneyFlowPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });
  const { data: household } = useCurrentHousehold();
  const accountsQuery = useAccounts(household?.id);
  const transactionsQuery = useTransactions(household?.id);
  const { data: accounts } = accountsQuery;
  const { data: transactions } = transactionsQuery;
  const categoryLabel = useCategoryDirectory(household?.id);

  const firstOccurredAt = (transactions ?? []).reduce<string | undefined>((min, tx) => (min === undefined || tx.occurredAt < min ? tx.occurredAt : min), undefined);
  const closedPeriods = household ? closedPeriodsCount(firstOccurredAt, household.periodStartDay || 1, new Date()) : 0;

  const flow = useMemo(() => {
    if (!household || !accounts || !transactions || closedPeriods < 1) return null;
    const { start, end } = previousClosedPeriodBounds(household.periodStartDay || 1, new Date());
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const periodTxs = transactions.filter((tx) => {
      const occurred = new Date(tx.occurredAt);
      return occurred >= start && occurred < end;
    });
    return computeMoneyFlow(periodTxs, {
      categoryLabel,
      accountLabel: (id) => accountById.get(id)?.name ?? id,
      otherIncome: t("moneyFlowPage.otherIncome"),
      otherExpense: t("moneyFlowPage.otherExpense"),
      investing: t("transactions.list.investing"),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household, accounts, transactions, closedPeriods]);

  const errorState = useQueryErrorState(accountsQuery.isError ? accountsQuery : transactionsQuery, { what: t("moneyFlowPage.loadError") });
  if (errorState) return <ErrorState {...errorState} />;

  if (!household || !accounts || !transactions) return <Skeleton height={320} style={{ marginTop: 16 }} />;

  if (closedPeriods < 1) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <EmptyState message={t("moneyFlowPage.needsClosedPeriod", { days: daysUntilPeriodCloses(household.periodStartDay || 1, new Date()) })} />
      </div>
    );
  }

  if (!flow || flow.links.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <EmptyState message={t("moneyFlowPage.empty")} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <NeedsFxBanner count={flow.excludedCount} />
      <div style={{ paddingTop: 24 }}>
        <Sankey nodes={flow.nodes} links={flow.links} height={Math.max(320, flow.nodes.length * 32)} />
      </div>
    </div>
  );
}
