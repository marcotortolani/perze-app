"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Amount, EmptyState, ErrorState, ListRow, NeedsFxBanner, SkeletonRow, StatusBadge, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useTransactions } from "@/hooks/use-transactions";
import { useDebts } from "@/hooks/use-debts";
import { useQueryErrorState } from "@/hooks/use-query-error-state";
import { money } from "@/lib/money/money";
import { ACCOUNT_KIND_MESSAGE_KEY } from "@/lib/reference/account-kind-labels";
import { DEBT_KIND_MESSAGE_KEY } from "@/lib/reference/debt-labels";

const DEBT_ACCOUNT_KINDS = new Set(["loan", "receivable", "credit_card"]);

/**
 * G4 — deudas: cuentas de tipo préstamo/por cobrar/tarjeta con saldo
 * pendiente, más los planes de cuotas y préstamos propios de `debts`
 * (G5/G6/G6a) — dos fuentes de datos porque son dos cosas reales: el
 * saldo de una cuenta y un plan de cuotas con cronograma propio.
 * Separado de `page.tsx` — ver el comentario en `budgets/BudgetsPageContent.tsx`.
 */
export default function DebtsPageContent() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const accountsQuery = useAccounts(household?.id);
  const transactionsQuery = useTransactions(household?.id);
  const debtsQuery = useDebts(household?.id);
  const { data: accounts } = accountsQuery;
  const { data: transactions } = transactionsQuery;
  const { data: debts } = debtsQuery;

  usePageHeader({ title: t("morePage.debts"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  const errorState = useQueryErrorState(accountsQuery.isError ? accountsQuery : transactionsQuery.isError ? transactionsQuery : debtsQuery, {
    what: t("debtsPage.loadError"),
  });
  if (errorState) return <ErrorState {...errorState} />;

  if (!household || !accounts || !transactions || !debts) {
    return (
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  const debtAccounts = accounts.filter((a) => DEBT_ACCOUNT_KINDS.has(a.kind) && a.archivedAt === null && a.currentBalance < 0n);

  if (debtAccounts.length === 0 && debts.length === 0) {
    return <EmptyState message={t("debtsPage.empty")} actionLabel={t("debtsPage.newDebt")} onAction={() => router.push("/debts/new")} />;
  }

  const needsFxCount = transactions.filter((tx) => tx.installmentGroupId !== null && tx.amountBase === null).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8, paddingBottom: 24 }}>
      <NeedsFxBanner count={needsFxCount} onResolve={() => router.push("/accounts/resolve-fx")} style={{ margin: "0 calc(-1 * var(--screen-padding)) 8px", borderRadius: 0 }} />
      <ListRow icon="plus" label={t("debtsPage.newDebt")} variant="action" onClick={() => router.push("/debts/new")} />
      {debts.map((debt) => (
        <ListRow
          key={debt.id}
          label={debt.name}
          meta={t(DEBT_KIND_MESSAGE_KEY[debt.kind])}
          variant="value"
          onClick={() => router.push(`/debts/${debt.id}`)}
          value={<Amount value={money(debt.principal, debt.currencyCode)} size="body" showSign={false} polarity="neutral" tabular />}
        />
      ))}
      {debtAccounts.map((a) => {
        const usage = a.creditLimit ? Number(-a.currentBalance) / Number(a.creditLimit) : null;
        return (
          <ListRow
            key={a.id}
            label={a.name}
            meta={t(ACCOUNT_KIND_MESSAGE_KEY[a.kind])}
            variant="value"
            onClick={() => router.push(`/accounts?account=${a.id}`)}
            value={
              <div style={{ textAlign: "right" }}>
                <Amount value={money(a.currentBalance, a.currencyCode)} size="body" showSign={false} tabular />
                {usage !== null ? (
                  <div style={{ marginTop: 2 }}>
                    <StatusBadge status={usage >= 1 ? "critical" : usage >= 0.8 ? "warning" : "neutral"}>
                      {t("accountsPage.list.creditLimitUsage", { percent: Math.round(usage * 100) })}
                    </StatusBadge>
                  </div>
                ) : null}
              </div>
            }
          />
        );
      })}
    </div>
  );
}
