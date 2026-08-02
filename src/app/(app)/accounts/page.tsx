"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Amount, Card, DragRow, EmptyState, ErrorState, Icon, ListRow, Skeleton, SkeletonRow, StatusBadge } from "@/design-system";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts, useInvalidateAccounts } from "@/hooks/use-accounts";
import { useNetWorth } from "@/hooks/use-net-worth";
import { useQueryErrorState } from "@/hooks/use-query-error-state";
import { useTransactions } from "@/hooks/use-transactions";
import { accountsRepo } from "@/lib/repos/accounts-repo";
import { money } from "@/lib/money/money";
import { ACCOUNT_KIND_ICON, ACCOUNT_KIND_MESSAGE_KEY } from "@/lib/reference/account-kind-labels";
import { COUNTRY_MESSAGE_KEY } from "@/lib/reference/countries-currencies";
import type { AccountRow } from "@/lib/db/schema";

/** CON-E01/LIB-13: reordena `group` y persiste `sortOrder` para las cuentas que cambiaron de posición. */
async function reorderAccounts(group: AccountRow[], fromIndex: number, toIndex: number, invalidate: () => void): Promise<void> {
  const next = [...group];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return;
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved);
  await Promise.all(next.map((a, i) => (a.sortOrder === i ? Promise.resolve() : accountsRepo.update(a.id, { sortOrder: i }))));
  invalidate();
}

const LIABILITY_KINDS = new Set(["credit_card", "loan"]);

/** E1 — lista de cuentas agrupada por moneda con subtotales. Bloque E, Fase 8. */
export default function AccountsPage() {
  const t = useTranslations();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const { data: household } = useCurrentHousehold();
  const accountsQuery = useAccounts(household?.id);
  const { data: accounts, isLoading } = accountsQuery;
  const { data: transactions = [] } = useTransactions(household?.id);
  const errorState = useQueryErrorState(accountsQuery, { what: t("accountsPage.list.errorWhat") });
  const netWorth = useNetWorth(household?.id, household?.baseCurrency, accounts ?? []);
  const invalidateAccounts = useInvalidateAccounts(household?.id);
  const pendingFxCount = transactions.filter((t) => t.fxRate === null).length;

  const baseCurrency = household?.baseCurrency ?? "UYU";
  const bySortOrder = (a: AccountRow, b: AccountRow) => a.sortOrder - b.sortOrder;
  const active = (accounts ?? []).filter((a) => a.archivedAt === null).sort(bySortOrder);
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

  if (errorState) return <ErrorState {...errorState} />;

  if (active.length === 0) {
    return <EmptyState message={t("accountsPage.list.empty")} actionLabel={t("accountsPage.list.emptyAction")} onAction={() => router.push("/accounts/new")} />;
  }

  const renderGroup = (group: AccountRow[]) =>
    isDesktop ? (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {group.map((a, i) => (
          <DesktopAccountCard
            key={a.id}
            account={a}
            onClick={() => router.push(`/accounts/${a.id}`)}
            onMoveUp={i > 0 ? () => reorderAccounts(group, i, i - 1, invalidateAccounts) : undefined}
            onMoveDown={i < group.length - 1 ? () => reorderAccounts(group, i, i + 1, invalidateAccounts) : undefined}
          />
        ))}
      </div>
    ) : (
      <div>
        {group.map((a, i) => (
          <DragRow key={a.id} id={a.id} index={i} rowHeight={64} dragLabel={t("accountsPage.list.reorder", { name: a.name })} onReorder={(from, to) => reorderAccounts(group, from, to, invalidateAccounts)}>
            <AccountCard account={a} onClick={() => router.push(`/accounts/${a.id}`)} />
          </DragRow>
        ))}
      </div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ flexShrink: 0, textAlign: "center", paddingTop: 16 }}>
        <span className="t-caption" style={{ color: "var(--text-muted)" }}>{t("accountsPage.list.netWorth")}</span>
        {netWorth.data ? (
          <div style={{ marginTop: 4 }}>
            <Amount value={netWorth.data.netWorth} size="hero" fit showSign={false} polarity="neutral" />
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

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", display: "flex", flexDirection: "column", gap: 24, paddingTop: 24, paddingBottom: 24 }}>
        <ListRow icon="plus" label={t("accountsPage.list.newAccount")} variant="action" onClick={() => router.push("/accounts/new")} />
        {!simple ? <ListRow icon="bank" label={t("accountsPage.list.currenciesAndRates")} onClick={() => router.push("/currencies")} /> : null}
        {pendingFxCount > 0 ? (
          <ListRow
            icon="alert"
            label={t("accountsPage.list.resolvePendingFx")}
            meta={t("accountsPage.list.pendingFxCount", { count: pendingFxCount })}
            // `window.location`, no `router.push`: `/accounts/resolve-fx` es
            // hermana de `[id]` bajo el mismo directorio que intercepta
            // `@detail/(.)[id]` — mismo problema y mismo arreglo que el
            // botón "Calendario" de `/transactions`, ver esa nota.
            onClick={() => { window.location.href = "/accounts/resolve-fx"; }}
          />
        ) : null}

        {simple ? (
          renderGroup(active)
        ) : (
          grouped.map(([currency, group]) => {
            const subtotal = group.reduce((s, a) => s + a.currentBalance, 0n);
            return (
              <div key={currency}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <span className="t-label" style={{ color: "var(--text-secondary)" }}>{currency}</span>
                  <Amount value={money(subtotal, currency)} size="label" showSign={false} polarity="neutral" tabular />
                </div>
                {renderGroup(group)}
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
    </div>
  );
}

/**
 * Tarjeta de cuenta para la grilla de escritorio (≥1024px) — `/dev/components`
 * la registra como pantalla-patrón nueva. Sin arrastre: en la grilla el
 * reorden es por menú (subir/bajar), porque `DragRow` asume índices 1-D y
 * una grilla es 2-D — ver la nota de la Fase 4 en el plan de auditoría
 * responsive. En móvil/tablet (`<1024px`) se sigue usando `DragRow`.
 */
function DesktopAccountCard({
  account,
  onClick,
  onMoveUp,
  onMoveDown,
}: {
  account: AccountRow;
  onClick: () => void;
  onMoveUp?: (() => void) | undefined;
  onMoveDown?: (() => void) | undefined;
}) {
  const t = useTranslations();
  const usage = account.kind === "credit_card" && account.creditLimit ? Number(-account.currentBalance) / Number(account.creditLimit) : null;
  return (
    <Card bordered padding={16} style={{ display: "flex", flexDirection: "column", gap: 12, cursor: "pointer" }} onClick={onClick}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Icon name={ACCOUNT_KIND_ICON[account.kind]} size={22} color="var(--text-secondary)" />
        <div style={{ display: "flex", gap: 2 }}>
          <button
            type="button"
            aria-label={t("accountsPage.moveUp")}
            disabled={!onMoveUp}
            onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
            style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: 0, cursor: onMoveUp ? "pointer" : "default", opacity: onMoveUp ? 1 : 0.3 }}
          >
            <Icon name="chevron" size={16} color="var(--text-secondary)" style={{ transform: "rotate(-90deg)" }} />
          </button>
          <button
            type="button"
            aria-label={t("accountsPage.moveDown")}
            disabled={!onMoveDown}
            onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
            style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: 0, cursor: onMoveDown ? "pointer" : "default", opacity: onMoveDown ? 1 : 0.3 }}
          >
            <Icon name="chevron" size={16} color="var(--text-secondary)" style={{ transform: "rotate(90deg)" }} />
          </button>
        </div>
      </div>
      <div>
        <div className="t-body" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{account.name}</div>
        <div className="t-caption" style={{ color: "var(--text-muted)" }}>
          {t(ACCOUNT_KIND_MESSAGE_KEY[account.kind])}
          {account.countryCode && account.countryCode in COUNTRY_MESSAGE_KEY ? ` · ${t(COUNTRY_MESSAGE_KEY[account.countryCode as keyof typeof COUNTRY_MESSAGE_KEY])}` : ""}
        </div>
      </div>
      <Amount value={money(account.currentBalance, account.currencyCode)} size="body" showSign={false} polarity="neutral" tabular />
      {usage !== null ? (
        <StatusBadge status={usage >= 1 ? "critical" : usage >= 0.8 ? "warning" : "neutral"}>
          {t("accountsPage.list.creditLimitUsage", { percent: Math.round(usage * 100) })}
        </StatusBadge>
      ) : null}
    </Card>
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
        meta={`${t(ACCOUNT_KIND_MESSAGE_KEY[account.kind])}${
          account.countryCode && account.countryCode in COUNTRY_MESSAGE_KEY
            ? ` · ${t(COUNTRY_MESSAGE_KEY[account.countryCode as keyof typeof COUNTRY_MESSAGE_KEY])}`
            : ""
        }`}
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
