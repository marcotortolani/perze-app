"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Amount, EmptyState, IconButton, ListRow, Skeleton, StatusBadge } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { usePayees } from "@/hooks/use-payees";
import { useInvalidateAfterTransactionWrite, useTransaction } from "@/hooks/use-transactions";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { transactionsRepo } from "@/lib/repos/transactions-repo";
import { formatRate } from "@/lib/fx/rate";
import { money } from "@/lib/money/money";
import type { Locale } from "@/i18n/formatting";

const FX_SOURCE_MESSAGE_KEY = {
  identity: "transactions.detail.fxSource.identity",
  manual: "transactions.detail.fxSource.manual",
  api: "transactions.detail.fxSource.api",
  inherited: "transactions.detail.fxSource.inherited",
  pending: "transactions.detail.fxSource.pending",
} as const;

/** D3 — detalle de transacción. Bloque D, Fase 7. */
export default function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const categoryLabel = useCategoryLabel();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: accounts = [] } = useAccounts(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const { data: payees = [] } = usePayees(household?.id);
  const { data: transaction, isLoading } = useTransaction(id);
  const invalidateTransactions = useInvalidateAfterTransactionWrite(household?.id);

  if (isLoading || !household) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 24 }}>
        <Skeleton height={48} />
        <Skeleton height={200} />
      </div>
    );
  }

  if (!transaction) {
    return <EmptyState message={t("transactions.detail.notFound")} actionLabel={t("transactions.detail.backToList")} onAction={() => router.push("/transactions")} />;
  }

  const account = accounts.find((a) => a.id === transaction.accountId);
  const counterAccount = transaction.counterAccountId ? accounts.find((a) => a.id === transaction.counterAccountId) : undefined;
  const category = transaction.categoryId ? categories.find((c) => c.id === transaction.categoryId) : undefined;
  const payee = transaction.payeeId ? payees.find((p) => p.id === transaction.payeeId) : undefined;
  const polarity = transaction.kind === "income" ? "positive" : transaction.kind === "transfer" ? "neutral" : "negative";
  const signedAmount = transaction.kind === "expense" ? -transaction.amount : transaction.amount;

  const handleDelete = async () => {
    await transactionsRepo.softDelete(transaction.id);
    invalidateTransactions();
    router.push("/transactions");
    toast(t("transactions.list.deleted"), {
      duration: 5000,
      action: {
        label: t("transactions.list.undo"),
        onClick: async () => {
          await transactionsRepo.restore(transaction.id);
          invalidateTransactions();
        },
      },
    });
  };

  const handleDuplicate = async () => {
    const copy = await transactionsRepo.create({
      householdId: transaction.householdId,
      createdBy: transaction.createdBy,
      kind: transaction.kind,
      occurredAt: new Date().toISOString(),
      accountId: transaction.accountId,
      counterAccountId: transaction.counterAccountId,
      amount: transaction.amount,
      currencyCode: transaction.currencyCode,
      originalAmount: transaction.originalAmount,
      originalCurrency: transaction.originalCurrency,
      originalRate: transaction.originalRate,
      fxRate: transaction.fxRate,
      fxSource: transaction.fxSource,
      fxProvider: transaction.fxProvider,
      fxQuoteKind: transaction.fxQuoteKind,
      fxResolvedAt: transaction.fxResolvedAt,
      amountBase: transaction.amountBase,
      counterAmount: transaction.counterAmount,
      counterCurrencyCode: transaction.counterCurrencyCode,
      counterFxRate: transaction.counterFxRate,
      categoryId: transaction.categoryId,
      payeeId: transaction.payeeId,
      note: transaction.note,
      attachments: [],
      location: null,
      status: "cleared",
      visibility: transaction.visibility,
      recurringId: null,
      installmentGroupId: null,
      installmentNumber: null,
      installmentTotal: null,
      source: "manual",
    });
    invalidateTransactions();
    router.push(`/transactions/${copy.id}`);
    toast(t("transactions.detail.duplicated"));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingTop: 16, paddingBottom: 24 }}>
      <IconButton icon="chevron-left" ariaLabel={t("transactions.detail.back")} onClick={() => router.push("/transactions")} style={{ alignSelf: "flex-start", margin: -11 }} />

      <div style={{ textAlign: "center" }}>
        <Amount value={money(signedAmount, transaction.currencyCode)} size="hero-xl" fit polarity={polarity} tabular mutedDecimals />
        {transaction.amountBase !== null && transaction.currencyCode !== household.baseCurrency ? (
          <div style={{ marginTop: 6 }}>
            <Amount value={money(transaction.kind === "expense" ? -transaction.amountBase : transaction.amountBase, household.baseCurrency)} size="body" polarity={polarity} tabular />
          </div>
        ) : null}
        {transaction.kind === "transfer" ? (
          <div style={{ marginTop: 8 }}>
            <StatusBadge status="neutral">{t("transactions.detail.notIncludedInTotal")}</StatusBadge>
          </div>
        ) : null}
      </div>

      <div>
        <ListRow
          icon={(category?.icon as IconName) ?? "cart"}
          label={category ? categoryLabel(category) : transaction.kind === "transfer" ? t("transactions.list.transfer") : t("transactions.detail.noCategory")}
          meta={t("transactions.detail.category")}
          variant="value"
        />
        <ListRow icon="wallet" label={account?.name ?? "—"} meta={counterAccount ? t("transactions.detail.toAccount", { account: counterAccount.name }) : t("transactions.detail.account")} variant="value" />
        <ListRow icon="calendar" label={new Date(transaction.occurredAt).toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" })} meta={t("transactions.detail.date")} variant="value" />
        {payee ? <ListRow icon="tag" label={payee.name} meta={t("transactions.detail.payee")} variant="value" /> : null}
        {transaction.note ? <ListRow icon="edit" label={transaction.note} meta={t("transactions.detail.note")} variant="value" /> : null}
      </div>

      {transaction.currencyCode !== household.baseCurrency ? (
        <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="t-label" style={{ color: "var(--text-secondary)" }}>
            {t("transactions.detail.fxRateUsed")}
          </span>
          {transaction.fxRate !== null ? (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--text-primary)" }}>
              {`1 ${transaction.currencyCode} = ${formatRate(transaction.fxRate)} ${household.baseCurrency}`}
            </span>
          ) : (
            <StatusBadge status="neutral">{t("transactions.detail.fxUnresolved")}</StatusBadge>
          )}
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {t(FX_SOURCE_MESSAGE_KEY[transaction.fxSource])}
            {transaction.fxProvider ? ` · ${transaction.fxProvider}` : ""}
          </span>
        </div>
      ) : null}

      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {t("transactions.detail.createdOn", { date: new Date(transaction.createdAt).toLocaleString(locale) })}
        {transaction.updatedAt !== transaction.createdAt
          ? t("transactions.detail.editedOn", { date: new Date(transaction.updatedAt).toLocaleString(locale) })
          : ""}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <ListRow icon="edit" label={t("transactions.detail.edit")} onClick={() => router.push(`/transactions/${transaction.id}/edit`)} />
        <ListRow icon="refresh" label={t("transactions.detail.duplicate")} onClick={handleDuplicate} />
        <ListRow icon="clock" label={t("transactions.detail.recurring")} onClick={() => toast(t("transactions.detail.recurringComingSoon"))} />
        <ListRow icon="chart" label={t("transactions.detail.split")} onClick={() => router.push(`/transactions/${transaction.id}/split`)} />
        <ListRow icon="trash" label={t("transactions.detail.delete")} destructive onClick={handleDelete} />
      </div>
    </div>
  );
}
