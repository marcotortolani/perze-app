"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Amount, Chip, EmptyState, ListRow, SkeletonRow, StatTile, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useRecurringRules } from "@/hooks/use-recurring-rules";
import { useTransactions } from "@/hooks/use-transactions";
import { computeMonthlyCommitted } from "@/lib/analytics/recurring-schedule";
import { formatAmountCompact } from "@/lib/money/format";
import { money } from "@/lib/money/money";

/** G2 — recurrentes: la plantilla y si ya se cargó el mes en curso. Separado de `page.tsx` — ver el comentario en `budgets/BudgetsPageContent.tsx`. */
export default function RecurringPageContent() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: household } = useCurrentHousehold();
  const { data: rules } = useRecurringRules(household?.id);
  const { data: accounts = [] } = useAccounts(household?.id);
  const accountFilter = searchParams.get("accountId");
  const currencyFilter = searchParams.get("currency");
  // Solo hace falta el mes en curso para "ya se cargó" — pedir el
  // historial entero (`useTransactions` sin filtro) hacía esperar esta
  // pantalla a una query mucho más pesada de lo que necesita, y encima
  // gateaba el render de las reglas recién creadas al resultado de ESA
  // query en vez de a `rules`, que ya estaba listo.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data: transactions } = useTransactions(household?.id, { from: monthStart });

  // Subpágina de `/more`: header propio con "volver", registrado vía `usePageHeader`.
  usePageHeader({ title: t("morePage.recurring"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

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

  const chargedThisMonth = new Set(
    transactions.filter((tx) => tx.recurringId && new Date(tx.occurredAt).getMonth() === now.getMonth() && new Date(tx.occurredAt).getFullYear() === now.getFullYear()).map((tx) => tx.recurringId)
  );
  const committed = computeMonthlyCommitted(rules);

  // Cuentas/monedas que de verdad tienen una regla — no todo el universo
  // de `accounts`, para no ofrecer un filtro que siempre da vacío.
  const accountsWithRules = accounts.filter((a) => rules.some((r) => r.accountId === a.id));
  const currenciesWithRules = [...new Set(rules.map((r) => r.currencyCode))].sort();

  const filteredRules = rules.filter((r) => (!accountFilter || r.accountId === accountFilter) && (!currencyFilter || r.currencyCode === currencyFilter));

  const setFilter = (key: "accountId" | "currency", value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`/recurring${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 8, paddingBottom: 24 }}>
        <StatTile label={t("recurringPage.committedPerMonth")} value={formatAmountCompact(money(committed, household.baseCurrency), { showSign: false })} style={{ marginBottom: 12 }} />
        <ListRow icon="calendar" label={t("recurringPage.viewCalendar")} onClick={() => router.push("/recurring/calendar")} />
        <ListRow icon="plus" label={t("recurringPage.newRule")} variant="action" onClick={() => router.push("/recurring/new")} />

        {accountsWithRules.length > 1 ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "8px 0" }}>
            <Chip selected={!accountFilter} onClick={() => setFilter("accountId", null)}>
              {t("recurringPage.filterAllAccounts")}
            </Chip>
            {accountsWithRules.map((a) => (
              <Chip key={a.id} selected={accountFilter === a.id} onClick={() => setFilter("accountId", a.id)}>
                {a.name}
              </Chip>
            ))}
          </div>
        ) : null}

        {currenciesWithRules.length > 1 ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 0 8px" }}>
            <Chip selected={!currencyFilter} onClick={() => setFilter("currency", null)}>
              {t("recurringPage.filterAllCurrencies")}
            </Chip>
            {currenciesWithRules.map((code) => (
              <Chip key={code} selected={currencyFilter === code} onClick={() => setFilter("currency", code)}>
                {code}
              </Chip>
            ))}
          </div>
        ) : null}

        {filteredRules.length === 0 ? <EmptyState message={t("recurringPage.emptyFiltered")} /> : null}

        {filteredRules.map((rule) => (
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
