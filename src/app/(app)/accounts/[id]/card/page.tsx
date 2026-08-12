"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Amount, Button, Chip, EmptyState, ListRow, ProgressBar, Sheet, Skeleton, StatusBadge, TransactionRow, usePageHeader } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import { useAccount, useAccounts, useInvalidateAccounts } from "@/hooks/use-accounts";
import { useAccountGroups } from "@/hooks/use-account-groups";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useTransaction, useTransactions, useInvalidateAfterTransactionWrite } from "@/hooks/use-transactions";
import { useCategories } from "@/hooks/use-categories";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useLatestCardStatement, useInvalidateCardStatements } from "@/hooks/use-card-statements";
import { useDebtsByAccount, useInvalidateDebts } from "@/hooks/use-debts";
import { useRecurringRules } from "@/hooks/use-recurring-rules";
import { PayCardSheet } from "@/features/cards/PayCardSheet";
import { ConfirmStatementSheet } from "@/features/cards/ConfirmStatementSheet";
import { cardPaymentSources, currentCycleStart, effectiveCardCycleConfig, expectedDueAmount } from "@/lib/analytics/card-cycle";
import { formatAmountCompact } from "@/lib/money/format";
import { money } from "@/lib/money/money";
import { formatDateShort, formatNumericDate, numberLocaleForUiLocale } from "@/i18n/formatting";
import { useDateFormatPreference } from "@/stores/format-preferences-store";
import type { Locale } from "@/i18n/formatting";

/** E4.1 — ciclo actual de una tarjeta: a pagar, cuándo, uso del límite, consumos del ciclo. */
export default function CardCyclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const dateFormat = useDateFormatPreference();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const userId = useEffectiveUserId();
  const { data: account, isLoading: accountLoading } = useAccount(id);
  usePageHeader({ onBack: () => router.back(), backLabel: t("ds.appHeader.back"), ...(account ? { title: account.name } : {}) });
  const { data: transactions } = useTransactions(household?.id, { accountId: id });
  const { data: categories = [] } = useCategories(household?.id);
  const { data: latestStatement, isLoading: statementLoading } = useLatestCardStatement(id);
  const { data: allAccounts = [] } = useAccounts(household?.id);
  const { data: accountGroups = [] } = useAccountGroups(household?.id);
  const { data: debtsForAccount = [] } = useDebtsByAccount(id);
  const { data: recurringRules = [] } = useRecurringRules(household?.id);
  const accountRecurringCount = recurringRules.filter((r) => r.accountId === id).length;
  const { data: settlementTx } = useTransaction(latestStatement?.settlementTransactionId ?? undefined);
  const categoryLabel = useCategoryLabel();
  const invalidateAccounts = useInvalidateAccounts(household?.id);
  const invalidateAfterWrite = useInvalidateAfterTransactionWrite(household?.id);
  const invalidateStatements = useInvalidateCardStatements(id);
  const invalidateDebts = useInvalidateDebts(household?.id);
  const [convertSheetOpen, setConvertSheetOpen] = useState(false);
  const [payCardSheetOpen, setPayCardSheetOpen] = useState(false);
  const [confirmSheetOpen, setConfirmSheetOpen] = useState(false);

  const currencyBreakdown = useMemo(() => {
    const totals = new Map<string, bigint>();
    for (const tx of transactions ?? []) {
      if (tx.kind !== "expense") continue;
      const currency = tx.originalCurrency ?? tx.currencyCode;
      const amount = tx.originalAmount ?? tx.amount;
      totals.set(currency, (totals.get(currency) ?? 0n) + amount);
    }
    return totals;
  }, [transactions]);

  if (accountLoading || statementLoading || !household || !transactions || !userId) return <Skeleton height={320} style={{ marginTop: 16 }} />;
  if (!account || account.kind !== "credit_card") return <EmptyState message={t("cardCyclePage.notFound")} />;

  // Tanda 4 — límite y ciclo pueden vivir en el grupo (multi-moneda) o en
  // la propia cuenta (tarjeta sin agrupar, compatibilidad). Nunca los dos
  // a la vez: `effectiveCardCycleConfig` decide cuál manda.
  const cardGroup = account.accountGroupId ? (accountGroups.find((g) => g.id === account.accountGroupId) ?? null) : null;
  const cycleConfig = effectiveCardCycleConfig(account, cardGroup);
  const groupSiblingAccounts = cardGroup ? allAccounts.filter((a) => a.id !== account.id && a.accountGroupId === cardGroup.id && a.archivedAt === null) : [];

  const now = new Date();
  const cycleStart = latestStatement ? new Date(latestStatement.periodStart) : currentCycleStart(cycleConfig.statementDay, now);
  const cycleTransactions = transactions.filter((tx) => tx.kind === "expense" && new Date(tx.occurredAt) >= cycleStart);
  const cycleTotal = cycleTransactions.reduce((s, tx) => s + tx.amount, 0n);

  const dueAmount = expectedDueAmount(account, latestStatement ?? null);
  const dueDate = latestStatement ? new Date(latestStatement.dueDate) : cycleConfig.dueDay ? new Date(now.getFullYear(), now.getMonth() + 1, cycleConfig.dueDay) : null;
  const closingDate = latestStatement ? new Date(latestStatement.closingDate) : cycleConfig.statementDay ? new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, cycleConfig.statementDay) : null;
  const daysToClose = closingDate ? Math.max(0, Math.ceil((closingDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : null;
  // El % de uso del límite solo se muestra sin conversión de por medio —
  // si el límite está en otra moneda que esta cuenta (grupo multi-moneda),
  // mostrar un % mezclando monedas sería un número falso; se muestra el
  // límite como dato de texto en su lugar (ver el bloque de abajo).
  const usage = cycleConfig.creditLimit && cycleConfig.limitCurrency === account.currencyCode ? Number(-account.currentBalance) / Number(cycleConfig.creditLimit) : null;
  const eligibleSources = cardPaymentSources(allAccounts, account);
  const isProjected = latestStatement?.projectionStatus === "projected";

  // Reconciliación: si la liquidación se pagó desde una cuenta de otra
  // moneda, `settlementTx.counterAmount` es lo que realmente se aplicó a
  // la tarjeta en su propia moneda — puede diferir del `statementBalance`
  // nominal (dólar tarjeta). No se calcula ningún impuesto/recargo acá,
  // solo se muestra la diferencia entre lo nominal y lo efectivamente
  // aplicado.
  const reconciliation =
    latestStatement && settlementTx && settlementTx.counterAmount !== null
      ? { nominal: latestStatement.statementBalance, applied: settlementTx.counterAmount, delta: latestStatement.statementBalance - settlementTx.counterAmount }
      : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 24, paddingBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="t-caption" style={{ color: "var(--text-muted)" }}>
              {dueDate ? t("cardCyclePage.dueOn", { date: formatDateShort(locale, dueDate) }) : t("cardCyclePage.dueUnknown")}
            </span>
            {isProjected ? <StatusBadge status="neutral">{t("cardCyclePage.projectedBadge")}</StatusBadge> : null}
          </div>
          <div style={{ marginTop: 6 }}>
            <Amount value={money(dueAmount > 0n ? dueAmount : 0n, account.currencyCode)} size="hero" fit showSign={false} polarity="neutral" tabular />
          </div>
          {closingDate ? (
            <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-secondary)" }}>
              {t("cardCyclePage.closesOn", { date: formatDateShort(locale, closingDate), days: daysToClose ?? 0 })}
            </div>
          ) : null}
          {latestStatement && isProjected ? (
            <div style={{ marginTop: 12 }}>
              <ListRow icon="check" label={t("cardCyclePage.statementArrived")} onClick={() => setConfirmSheetOpen(true)} variant="action" />
            </div>
          ) : null}
        </div>

        {cycleConfig.creditLimit ? (
          <div>
            {cycleConfig.limitCurrency === account.currencyCode ? (
              <>
                <ProgressBar value={usage ?? 0} height={8} />
                <div style={{ marginTop: 8, fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  {t("accountsPage.detail.cycleOf", {
                    spent: formatAmountCompact(money(-account.currentBalance, account.currencyCode), { showSign: false }),
                    limit: formatAmountCompact(money(cycleConfig.creditLimit, cycleConfig.limitCurrency), { showSign: false }),
                  })}
                </div>
              </>
            ) : (
              // Grupo multi-moneda con el límite declarado en OTRA moneda
              // que esta cuenta: mostrar un % mezclando monedas sería un
              // número falso (mismo criterio que el "dólar tarjeta" — un
              // estimador vale para un gauge, nunca como dato duro). Se
              // muestra el límite compartido como texto, sin barra.
              <div className="t-caption" style={{ color: "var(--text-muted)" }}>
                {t("cardCyclePage.sharedLimit", { amount: formatAmountCompact(money(cycleConfig.creditLimit, cycleConfig.limitCurrency ?? account.currencyCode), { showSign: false }) })}
              </div>
            )}
          </div>
        ) : null}

        {groupSiblingAccounts.length > 0 ? (
          <div>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("cardCyclePage.groupAccounts")}</div>
            {groupSiblingAccounts.map((sibling) => (
              <ListRow
                key={sibling.id}
                label={`${sibling.name} · ${sibling.currencyCode}`}
                variant="value"
                value={formatAmountCompact(money(-sibling.currentBalance, sibling.currencyCode), { showSign: false })}
                onClick={() => router.push(`/accounts/${sibling.id}/card`)}
              />
            ))}
          </div>
        ) : null}

        <div>
          <ListRow label={t("cardCyclePage.cycleConsumptions")} meta={t("cardCyclePage.cycleConsumptionsMeta", { count: cycleTransactions.length, date: formatDateShort(locale, cycleStart) })} variant="value" value={formatAmountCompact(money(cycleTotal, account.currencyCode), { showSign: false })} />
          <ListRow label={t("cardCyclePage.installments")} onClick={() => router.push(`/accounts/${id}/installments`)} />
          {accountRecurringCount > 0 ? (
            <ListRow label={t("recurringPage.viewRecurring")} variant="value" value={String(accountRecurringCount)} onClick={() => router.push(`/recurring?accountId=${id}`)} />
          ) : null}
        </div>

        {currencyBreakdown.size > 1 ? (
          <div>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("cardCyclePage.currencyBreakdown")}</div>
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Array.from(currencyBreakdown.entries()).map(([currency, total]) => (
                <Chip key={currency}>{`${currency} · ${formatAmountCompact(money(total, currency), { showSign: false })}`}</Chip>
              ))}
            </div>
          </div>
        ) : null}

        {reconciliation ? (
          <div>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("cardCyclePage.reconciliation")}</div>
            <div style={{ marginTop: 6, fontSize: 14, color: "var(--text-primary)" }}>
              {reconciliation.delta > 0n
                ? t("cardCyclePage.reconciliationSaved", { amount: formatAmountCompact(money(reconciliation.delta, account.currencyCode), { showSign: false }) })
                : reconciliation.delta < 0n
                  ? t("cardCyclePage.reconciliationExtra", { amount: formatAmountCompact(money(-reconciliation.delta, account.currencyCode), { showSign: false }) })
                  : t("cardCyclePage.reconciliationExact")}
            </div>
          </div>
        ) : null}

        <div>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("cardCyclePage.recentConsumptions")}</div>
          {cycleTransactions.slice(0, 10).map((tx) => {
            const category = tx.categoryId ? categories.find((c) => c.id === tx.categoryId) : undefined;
            return (
              <TransactionRow
                key={tx.id}
                icon={(category?.icon as IconName) ?? "cart"}
                merchant={category ? categoryLabel(category) : t("home.movement")}
                meta={formatNumericDate(locale, new Date(tx.occurredAt), dateFormat)}
                value={money(-tx.amount, tx.currencyCode)}
                polarity="negative"
                onClick={() => router.push(`/transactions?tx=${tx.id}`)}
              />
            );
          })}
        </div>

        <ListRow icon="refresh" label={t("cardCyclePage.convertToInstallments")} onClick={() => setConvertSheetOpen(true)} />
        <Button disabled={dueAmount <= 0n || eligibleSources.length === 0} onClick={() => setPayCardSheetOpen(true)}>
          {t("cardCyclePage.payCard")}
        </Button>
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
                  meta={formatNumericDate(locale, new Date(tx.occurredAt), dateFormat)}
                  variant="value"
                  value={formatAmountCompact(money(tx.amount, tx.currencyCode), { showSign: false })}
                  onClick={() => router.push(`/debts/new?fromTransaction=${tx.id}`)}
                />
              );
            })
          )}
        </div>
      </Sheet>

      <PayCardSheet
        open={payCardSheetOpen}
        card={account}
        cardGroup={cardGroup}
        accounts={allAccounts}
        expectedDue={dueAmount}
        installmentDebts={debtsForAccount}
        household={household}
        userId={userId}
        numberLocale={numberLocaleForUiLocale(locale)}
        locale={locale}
        onClose={() => setPayCardSheetOpen(false)}
        onPaid={() => {
          invalidateAfterWrite();
          invalidateAccounts();
          invalidateStatements();
          invalidateDebts();
        }}
      />

      {latestStatement ? (
        <ConfirmStatementSheet
          open={confirmSheetOpen}
          statement={latestStatement}
          numberLocale={numberLocaleForUiLocale(locale)}
          onClose={() => setConfirmSheetOpen(false)}
          onConfirmed={() => {
            invalidateStatements();
            invalidateAccounts();
          }}
        />
      ) : null}
    </div>
  );
}
