"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Amount, Button, Chip, EmptyState, Keypad, ListRow, ProgressBar, Sheet, Skeleton, TransactionRow, usePageHeader } from "@/design-system";
import { AccountPickerSheet } from "@/features/capture/AccountPickerSheet";
import type { IconName } from "@/design-system/core/Icon";
import { useAccount, useAccounts, useInvalidateAccounts } from "@/hooks/use-accounts";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { useTransaction, useTransactions, useInvalidateAfterTransactionWrite } from "@/hooks/use-transactions";
import { useCategories } from "@/hooks/use-categories";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useLatestCardStatement, useInvalidateCardStatements } from "@/hooks/use-card-statements";
import { useDebtsByAccount, useInvalidateDebts } from "@/hooks/use-debts";
import { useRecurringRules } from "@/hooks/use-recurring-rules";
import { debtsRepo } from "@/lib/repos/debts-repo";
import { cardStatementsRepo } from "@/lib/repos/card-statements-repo";
import { saveDraftAsTransaction } from "@/features/capture/save-transaction";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import { formatAmountCompact } from "@/lib/money/format";
import { money } from "@/lib/money/money";
import { formatDateShort, numberLocaleForUiLocale } from "@/i18n/formatting";
import type { Locale } from "@/i18n/formatting";
import type { AccountRow } from "@/lib/db/schema";

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
  const userId = useCurrentUserId();
  const { data: account, isLoading: accountLoading } = useAccount(id);
  usePageHeader({ onBack: () => router.back(), backLabel: t("ds.appHeader.back"), ...(account ? { title: account.name } : {}) });
  const { data: transactions } = useTransactions(household?.id, { accountId: id });
  const { data: categories = [] } = useCategories(household?.id);
  const { data: latestStatement, isLoading: statementLoading } = useLatestCardStatement(id);
  const { data: allAccounts = [] } = useAccounts(household?.id);
  const { data: debtsForAccount } = useDebtsByAccount(id);
  const { data: recurringRules = [] } = useRecurringRules(household?.id);
  const accountRecurringCount = recurringRules.filter((r) => r.accountId === id).length;
  const { data: settlementTx } = useTransaction(latestStatement?.settlementTransactionId ?? undefined);
  const categoryLabel = useCategoryLabel();
  const invalidateAccounts = useInvalidateAccounts(household?.id);
  const invalidateAfterWrite = useInvalidateAfterTransactionWrite(household?.id);
  const invalidateStatements = useInvalidateCardStatements(id);
  const invalidateDebts = useInvalidateDebts(household?.id);
  const [convertSheetOpen, setConvertSheetOpen] = useState(false);
  const [settleAccountSheetOpen, setSettleAccountSheetOpen] = useState(false);
  const [settleSourceAccount, setSettleSourceAccount] = useState<AccountRow | null>(null);
  const [settleExpr, setSettleExpr] = useState("");
  const [settling, setSettling] = useState(false);

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

  const settleSourceCandidates = allAccounts.filter((a) => a.id !== account.id && a.archivedAt === null);

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

  const handleSettle = async () => {
    if (!settleSourceAccount || !userId || settling) return;
    setSettling(true);
    try {
      const draft = {
        kind: "transfer" as const,
        amountExpression: settleExpr || "0",
        currency: settleSourceAccount.currencyCode,
        accountId: settleSourceAccount.id,
        counterAccountId: account.id,
        counterFxRateOverride: null,
        amountPinnedTo: "account" as const,
        categoryId: null,
        occurredAt: new Date().toISOString(),
        payeeName: "",
        note: "",
        tagIds: [],
        burstMode: false,
        burstCount: 0,
      };
      const tx = await saveDraftAsTransaction({
        draft,
        household,
        userId,
        account: settleSourceAccount,
        counterAccount: account,
        numberLocale: numberLocaleForUiLocale(locale),
      });
      const appliedToCard = tx.counterAmount ?? tx.amount;
      if (latestStatement) {
        await cardStatementsRepo.markPaid(latestStatement.id, appliedToCard, tx.id);
        const plans = (debtsForAccount ?? []).filter((d) => d.kind === "installment_plan");
        for (const plan of plans) {
          const schedule = await debtsRepo.listSchedule(plan.id);
          const dueItems = schedule.filter((item) => !item.paidAt && item.dueDate >= latestStatement.periodStart && item.dueDate <= latestStatement.periodEnd);
          for (const item of dueItems) await debtsRepo.markInstallmentPaid(item.id, tx.id);
        }
        invalidateDebts();
      }
      invalidateAfterWrite();
      invalidateAccounts();
      invalidateStatements();
      toast(t("cardCyclePage.settled"));
      setSettleExpr("");
      setSettleSourceAccount(null);
    } catch {
      toast(t("cardCyclePage.settleError"));
    } finally {
      setSettling(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 24, paddingBottom: 24 }}>
        <div>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>
            {dueDate ? t("cardCyclePage.dueOn", { date: formatDateShort(locale, dueDate) }) : t("cardCyclePage.dueUnknown")}
          </div>
          <div style={{ marginTop: 6 }}>
            <Amount value={money(dueAmount > 0n ? dueAmount : 0n, account.currencyCode)} size="hero" fit showSign={false} polarity="neutral" tabular />
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
                meta={tx.occurredAt.slice(0, 10)}
                value={money(-tx.amount, tx.currencyCode)}
                polarity="negative"
                onClick={() => router.push(`/transactions/${tx.id}`)}
              />
            );
          })}
        </div>

        <ListRow icon="refresh" label={t("cardCyclePage.convertToInstallments")} onClick={() => setConvertSheetOpen(true)} />
        <Button disabled={!latestStatement || dueAmount <= 0n} onClick={() => setSettleAccountSheetOpen(true)}>
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

      <AccountPickerSheet
        open={settleAccountSheetOpen}
        title={t("cardCyclePage.settlePickAccount")}
        accounts={settleSourceCandidates}
        onSelect={(a) => setSettleSourceAccount(a)}
        onClose={() => setSettleAccountSheetOpen(false)}
      />

      <Sheet open={settleSourceAccount !== null} title={t("cardCyclePage.settleAmountTitle", { name: settleSourceAccount?.name ?? "" })} onClose={() => setSettleSourceAccount(null)}>
        {settleSourceAccount ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p className="t-caption" style={{ color: "var(--text-muted)", margin: 0 }}>
              {t("cardCyclePage.settleDueHint", { amount: formatAmountCompact(money(dueAmount > 0n ? dueAmount : 0n, account.currencyCode), { showSign: false }) })}
            </p>
            <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 28 }}>
              {settleSourceAccount.currencyCode} {settleExpr || "0"}
            </div>
            <Keypad onKey={(k) => setSettleExpr((s) => (k === "backspace" ? s.slice(0, -1) : s + k))} onClear={() => setSettleExpr("")} />
            <Button
              disabled={settling || !evaluateSettleAmount(settleExpr, settleSourceAccount.currencyCode, numberLocaleForUiLocale(locale))}
              onClick={handleSettle}
            >
              {t("cardCyclePage.confirmSettle")}
            </Button>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

function evaluateSettleAmount(expr: string, currency: string, numberLocale: ReturnType<typeof numberLocaleForUiLocale>): boolean {
  if (expr.trim() === "") return false;
  try {
    return evaluateKeypadExpression(expr, currency, numberLocale).amount > 0n;
  } catch {
    return false;
  }
}
