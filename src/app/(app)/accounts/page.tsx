"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Amount, EmptyState, ListRow, Skeleton, SkeletonRow, StatusBadge } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useNetWorth } from "@/hooks/use-net-worth";
import { useTransactions } from "@/hooks/use-transactions";
import { money } from "@/lib/money/money";
import { ACCOUNT_KIND_ICON, ACCOUNT_KIND_MESSAGE_KEY } from "@/lib/reference/account-kind-labels";
import { countryFlag } from "@/lib/reference/countries-currencies";
import type { AccountRow } from "@/lib/db/schema";

const LIABILITY_KINDS = new Set(["credit_card", "loan"]);

/** E1 — lista de cuentas agrupada por moneda con subtotales. Bloque E, Fase 8. */
export default function AccountsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: accounts, isLoading } = useAccounts(household?.id);
  const { data: transactions = [] } = useTransactions(household?.id);
  const netWorth = useNetWorth(household?.id, household?.baseCurrency, accounts ?? []);
  const pendingFxCount = transactions.filter((t) => t.fxRate === null).length;

  const baseCurrency = household?.baseCurrency ?? "UYU";
  const active = (accounts ?? []).filter((a) => a.archivedAt === null);
  const archived = (accounts ?? []).filter((a) => a.archivedAt !== null);
  const currencies = [...new Set(active.map((a) => a.currencyCode))];
  const simple = currencies.length <= 1;

  const byCurrency = new Map<string, AccountRow[]>();
  for (const a of active) {
    const list = byCurrency.get(a.currencyCode) ?? [];
    list.push(a);
    byCurrency.set(a.currencyCode, list);
  }
  const grouped = [...byCurrency.entries()].sort(([a], [b]) => (a === baseCurrency ? -1 : b === baseCurrency ? 1 : a.localeCompare(b)));

  const assetsTotal = active.filter((a) => a.includeInNetWorth && !LIABILITY_KINDS.has(a.kind)).reduce((s, a) => s + a.currentBalance, 0n);
  const liabilitiesTotal = active.filter((a) => a.includeInNetWorth && LIABILITY_KINDS.has(a.kind) && a.currentBalance < 0n).reduce((s, a) => s + a.currentBalance, 0n);

  if (!household || isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 16 }}>
        <Skeleton width={160} height={40} style={{ marginBottom: 16 }} />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (active.length === 0) {
    return <EmptyState icon="wallet" message={t("accountsPage.list.empty")} actionLabel={t("accountsPage.list.emptyAction")} onAction={() => router.push("/accounts/new")} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingTop: 16, paddingBottom: 24 }}>
      <div style={{ textAlign: "center" }}>
        <span className="t-caption" style={{ color: "var(--text-muted)" }}>{t("accountsPage.list.netWorth")}</span>
        {netWorth.data ? (
          <div style={{ marginTop: 4 }}>
            <Amount value={netWorth.data.netWorth} size="hero" showSign={false} polarity="neutral" tabular />
          </div>
        ) : (
          <Skeleton width={140} height={32} style={{ margin: "4px auto 0" }} />
        )}
        <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 8, fontSize: 13, color: "var(--text-secondary)" }}>
          <span>
            {t("accountsPage.list.assets")} <Amount value={money(assetsTotal, baseCurrency)} size="label" showSign={false} polarity="neutral" tabular />
          </span>
          <span>
            {t("accountsPage.list.liabilities")} <Amount value={money(liabilitiesTotal, baseCurrency)} size="label" showSign={false} polarity="neutral" tabular />
          </span>
        </div>
      </div>

      <ListRow icon="plus" label={t("accountsPage.list.newAccount")} variant="action" onClick={() => router.push("/accounts/new")} />
      {!simple ? <ListRow icon="bank" label={t("accountsPage.list.currenciesAndRates")} onClick={() => router.push("/monedas")} /> : null}
      {pendingFxCount > 0 ? (
        <ListRow
          icon="alert"
          label={t("accountsPage.list.resolvePendingFx")}
          meta={t("accountsPage.list.pendingFxCount", { count: pendingFxCount })}
          onClick={() => router.push("/accounts/resolve-fx")}
        />
      ) : null}

      {simple ? (
        <div>
          {active.map((a) => (
            <AccountCard key={a.id} account={a} onClick={() => router.push(`/accounts/${a.id}`)} />
          ))}
        </div>
      ) : (
        grouped.map(([currency, group]) => {
          const subtotal = group.reduce((s, a) => s + a.currentBalance, 0n);
          return (
            <div key={currency}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <span className="t-label" style={{ color: "var(--text-secondary)" }}>{currency}</span>
                <Amount value={money(subtotal, currency)} size="label" showSign={false} polarity="neutral" tabular />
              </div>
              {group.map((a) => (
                <AccountCard key={a.id} account={a} onClick={() => router.push(`/accounts/${a.id}`)} />
              ))}
            </div>
          );
        })
      )}

      {archived.length > 0 ? (
        <div>
          <span className="t-label" style={{ color: "var(--text-muted)" }}>{t("accountsPage.list.archived")}</span>
          {archived.map((a) => (
            <AccountCard key={a.id} account={a} onClick={() => router.push(`/accounts/${a.id}`)} muted />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AccountCard({ account, onClick, muted = false }: { account: AccountRow; onClick: () => void; muted?: boolean }) {
  const t = useTranslations();
  const usage = account.kind === "credit_card" && account.creditLimit ? Number(-account.currentBalance) / Number(account.creditLimit) : null;
  return (
    <div style={{ opacity: muted ? 0.55 : 1 }}>
      <ListRow
        icon={ACCOUNT_KIND_ICON[account.kind]}
        label={account.name}
        meta={`${t(ACCOUNT_KIND_MESSAGE_KEY[account.kind])}${account.countryCode ? ` · ${countryFlag(account.countryCode)}` : ""}`}
        value={
          <div style={{ textAlign: "right" }}>
            <Amount value={money(account.currentBalance, account.currencyCode)} size="body" showSign={false} polarity="neutral" tabular />
            {usage !== null ? (
              <div style={{ marginTop: 2 }}>
                <StatusBadge status={usage >= 1 ? "critical" : usage >= 0.8 ? "warning" : "neutral"}>
                  {t("accountsPage.list.creditLimitUsage", { percent: Math.round(usage * 100) })}
                </StatusBadge>
              </div>
            ) : null}
          </div>
        }
        onClick={onClick}
      />
    </div>
  );
}
