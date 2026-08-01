"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader, Button, EmptyState, ListRow, ProgressBar, Sheet, Skeleton, TransactionRow } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import { useAccount } from "@/hooks/use-accounts";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategories } from "@/hooks/use-categories";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useLatestCardStatement } from "@/hooks/use-card-statements";
import { formatAmountCompact } from "@/lib/money/format";
import { money } from "@/lib/money/money";
import { formatDateShort } from "@/i18n/formatting";
import type { Locale } from "@/i18n/formatting";

function currentCycleStart(statementDay: number | null, now: Date): Date {
  if (!statementDay) return new Date(now.getFullYear(), now.getMonth(), 1);
  const start = new Date(now.getFullYear(), now.getMonth(), statementDay);
  if (start > now) start.setMonth(start.getMonth() - 1);
  return start;
}

/** E4.1 — ciclo actual de una tarjeta: a pagar, cuándo, uso del límite, consumos del ciclo. */
export default function CardCyclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: account, isLoading: accountLoading } = useAccount(id);
  const { data: transactions } = useTransactions(household?.id, { accountId: id });
  const { data: categories = [] } = useCategories(household?.id);
  const { data: latestStatement, isLoading: statementLoading } = useLatestCardStatement(id);
  const categoryLabel = useCategoryLabel();
  const [convertSheetOpen, setConvertSheetOpen] = useState(false);

  if (accountLoading || statementLoading || !household || !transactions) return <Skeleton height={320} style={{ marginTop: 16 }} />;
  if (!account || account.kind !== "credit_card") return <EmptyState message={t("cardCyclePage.notFound")} />;

  const now = new Date();
  const cycleStart = latestStatement ? new Date(latestStatement.periodStart) : currentCycleStart(account.statementDay, now);
  const cycleTransactions = transactions.filter((tx) => tx.kind === "expense" && new Date(tx.occurredAt) >= cycleStart);
  const cycleTotal = cycleTransactions.reduce((s, tx) => s + tx.amount, 0n);

  const dueAmount = latestStatement ? latestStatement.statementBalance - latestStatement.paidAmount : cycleTotal;
  const dueDate = latestStatement ? new Date(latestStatement.dueDate) : account.dueDay ? new Date(now.getFullYear(), now.getMonth() + 1, account.dueDay) : null;
  const closingDate = latestStatement ? new Date(latestStatement.closingDate) : account.statementDay ? new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, account.statementDay) : null;
  const daysToClose = closingDate ? Math.max(0, Math.ceil((closingDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : null;
  const usage = account.creditLimit ? Number(-account.currentBalance) / Number(account.creditLimit) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={account.name} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 24, paddingBottom: 24 }}>
        <div>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>
            {dueDate ? t("cardCyclePage.dueOn", { date: formatDateShort(locale, dueDate) }) : t("cardCyclePage.dueUnknown")}
          </div>
          <div style={{ marginTop: 6 }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 44, fontWeight: 600, letterSpacing: "-.02em" }}>
              {formatAmountCompact(money(dueAmount > 0n ? dueAmount : 0n, account.currencyCode), { showSign: false })}
            </span>
          </div>
          {closingDate ? (
            <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-secondary)" }}>
              {t("cardCyclePage.closesOn", { date: formatDateShort(locale, closingDate), days: daysToClose ?? 0 })}
            </div>
          ) : null}
        </div>

        {account.creditLimit ? (
          <div>
            <ProgressBar value={usage ?? 0} height={8} />
            <div style={{ marginTop: 8, fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
              {t("accountsPage.detail.cycleOf", {
                spent: formatAmountCompact(money(-account.currentBalance, account.currencyCode), { showSign: false }),
                limit: formatAmountCompact(money(account.creditLimit, account.currencyCode), { showSign: false }),
              })}
            </div>
          </div>
        ) : null}

        <div>
          <ListRow label={t("cardCyclePage.cycleConsumptions")} meta={t("cardCyclePage.cycleConsumptionsMeta", { count: cycleTransactions.length, date: formatDateShort(locale, cycleStart) })} variant="value" value={formatAmountCompact(money(cycleTotal, account.currencyCode), { showSign: false })} />
          <ListRow label={t("cardCyclePage.installments")} onClick={() => router.push(`/accounts/${id}/installments`)} />
        </div>

        <div>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("cardCyclePage.recentConsumptions")}</div>
          {cycleTransactions.slice(0, 10).map((tx) => {
            const category = tx.categoryId ? categories.find((c) => c.id === tx.categoryId) : undefined;
            return (
              <TransactionRow
                key={tx.id}
                icon={(category?.icon as IconName) ?? "cart"}
                merchant={category ? categoryLabel(category) : t("home.movement")}
                meta={tx.occurredAt.slice(0, 10)}
                value={money(-tx.amount, tx.currencyCode)}
                polarity="negative"
                onClick={() => router.push(`/transactions/${tx.id}`)}
              />
            );
          })}
        </div>

        <ListRow icon="refresh" label={t("cardCyclePage.convertToInstallments")} onClick={() => setConvertSheetOpen(true)} />
        <Button onClick={() => router.push("/add")}>{t("cardCyclePage.payCard")}</Button>
      </div>

      <Sheet open={convertSheetOpen} title={t("cardCyclePage.convertToInstallments")} onClose={() => setConvertSheetOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {cycleTransactions.length === 0 ? (
            <p className="t-body" style={{ color: "var(--text-muted)" }}>{t("cardCyclePage.noConsumptions")}</p>
          ) : (
            cycleTransactions.map((tx) => {
              const category = tx.categoryId ? categories.find((c) => c.id === tx.categoryId) : undefined;
              return (
                <ListRow
                  key={tx.id}
                  label={category ? categoryLabel(category) : t("home.movement")}
                  meta={tx.occurredAt.slice(0, 10)}
                  variant="value"
                  value={formatAmountCompact(money(tx.amount, tx.currencyCode), { showSign: false })}
                  onClick={() => router.push(`/debts/new?fromTransaction=${tx.id}`)}
                />
              );
            })
          )}
        </div>
      </Sheet>
    </div>
  );
}
