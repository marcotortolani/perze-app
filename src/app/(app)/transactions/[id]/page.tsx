"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Amount, Button, EmptyState, FxEditor, Keypad, ListRow, Sheet, Skeleton, StatusBadge, usePageHeader } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { usePayees } from "@/hooks/use-payees";
import { useTags } from "@/hooks/use-tags";
import { useTagIdsForTransaction } from "@/hooks/use-transaction-tags";
import { useInvalidateAfterTransactionWrite, useTransaction } from "@/hooks/use-transactions";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { isCreditCardAccount } from "@/lib/analytics/card-cycle";
import { transactionsRepo } from "@/lib/repos/transactions-repo";
import { resolvePendingFx } from "@/features/movements/resolve-pending-fx";
import { useDeleteTransactionWithUndo } from "@/features/movements/use-delete-transaction";
import { fxRepo } from "@/lib/repos/fx-repo";
import { todayIso } from "@/lib/dates/today";
import { formatRateTrimmed, rateFromInteger, type ScaledRate } from "@/lib/fx/rate";
import { appendKeypadRateDigit, parseKeypadRate } from "@/lib/fx/rate-keypad";
import { money } from "@/lib/money/money";
import { decimalSeparatorForLocale, type Locale } from "@/i18n/formatting";

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
  const { data: tags = [] } = useTags(household?.id);
  const { data: tagIds = [] } = useTagIdsForTransaction(id);
  const { data: transaction, isLoading } = useTransaction(id);
  const invalidateTransactions = useInvalidateAfterTransactionWrite(household?.id);
  const deleteTransaction = useDeleteTransactionWithUndo(household?.id);
  const decimalSeparator = decimalSeparatorForLocale(locale);

  // Resolver FX de ESTE movimiento puntual — mismo patrón que
  // `/accounts/resolve-fx` (E8, bulk), pero sin agrupar por moneda: acá
  // solo hay una transacción, así que no hace falta `setManualOverride`
  // ni tocar las demás pendientes de la misma moneda.
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveRate, setResolveRate] = useState<ScaledRate>(rateFromInteger(1));
  const [resolveKeypadDigits, setResolveKeypadDigits] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  // `router.back()`, no `push("/transactions")`: la ruta ya está montada por
  // detrás del slot @detail, así que un push blando no desmonta el
  // interceptor — no pasa nada visible, pero la entrada se apila en el
  // historial y el gesto de volver después necesita dos swipes.
  usePageHeader({ onBack: () => router.back(), backLabel: t("transactions.detail.back") });

  if (isLoading || !household) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 24 }}>
        <Skeleton height={48} />
        <Skeleton height={200} />
      </div>
    );
  }

  if (!transaction) {
    return (
      <EmptyState message={t("transactions.detail.notFound")} actionLabel={t("transactions.detail.backToList")} onAction={() => router.push("/transactions")} />
    );
  }

  const account = accounts.find((a) => a.id === transaction.accountId);
  const counterAccount = transaction.counterAccountId ? accounts.find((a) => a.id === transaction.counterAccountId) : undefined;
  // Un `transfer` cuyo destino es una tarjeta de crédito ES un pago de
  // tarjeta, por definición — se deriva acá, no depende de que exista un
  // vínculo a `card_statements` (los pagos hechos antes de esta
  // distinción, o hechos offline, nunca lo tuvieron). Es el lugar de la
  // app donde más confunde ver "Transferencia" sin más contexto.
  const cardPayment = transaction.kind === "transfer" && !!counterAccount && isCreditCardAccount(counterAccount);
  const category = transaction.categoryId ? categories.find((c) => c.id === transaction.categoryId) : undefined;
  const payee = transaction.payeeId ? payees.find((p) => p.id === transaction.payeeId) : undefined;
  const tagNames = tagIds.map((tagId) => tags.find((tag) => tag.id === tagId)?.name).filter((name): name is string => !!name);
  const polarity = transaction.kind === "income" ? "positive" : transaction.kind === "transfer" || transaction.kind === "adjustment" ? "neutral" : "negative";
  const signedAmount = transaction.kind === "expense" ? -transaction.amount : transaction.amount;

  const handleDelete = async () => {
    await deleteTransaction(transaction.id);
    router.push("/transactions");
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

  const openResolveFx = async () => {
    const resolution = await fxRepo.resolve({ householdId: household.id, base: transaction.currencyCode, quote: household.baseCurrency, date: todayIso() });
    setResolveRate(resolution.rate ?? rateFromInteger(1));
    setResolveOpen(true);
  };

  const openResolveKeypad = () => {
    const [wholePart, decPart] = formatRateTrimmed(resolveRate).split(".");
    setResolveKeypadDigits(decPart ? `${wholePart}${decimalSeparator}${decPart}` : wholePart!);
  };

  const commitResolveKeypad = () => {
    if (resolveKeypadDigits !== null) {
      const parsed = parseKeypadRate(resolveKeypadDigits, decimalSeparator);
      if (parsed !== null) setResolveRate(parsed);
    }
    setResolveKeypadDigits(null);
  };

  const applyResolveFx = async () => {
    if (resolving) return;
    setResolving(true);
    try {
      await resolvePendingFx({ transactionId: transaction.id, baseCurrency: household.baseCurrency, rate: resolveRate });
      invalidateTransactions();
      toast(t("transactions.detail.fxResolved"));
      setResolveOpen(false);
    } finally {
      setResolving(false);
    }
  };

  return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingTop: 16, paddingBottom: 24 }}>
      <div style={{ textAlign: "center" }}>
        <Amount value={money(signedAmount, transaction.currencyCode)} size="hero-xl" fit polarity={polarity} tabular mutedDecimals />
        {transaction.amountBase !== null && transaction.currencyCode !== household.baseCurrency ? (
          <div style={{ marginTop: 6 }}>
            <Amount value={money(transaction.kind === "expense" ? -transaction.amountBase : transaction.amountBase, household.baseCurrency)} size="body" polarity={polarity} tabular />
          </div>
        ) : null}
        {transaction.kind === "transfer" || transaction.kind === "adjustment" ? (
          <div style={{ marginTop: 8 }}>
            <StatusBadge status="neutral">{t("transactions.detail.notIncludedInTotal")}</StatusBadge>
          </div>
        ) : null}
      </div>

      <div>
        <ListRow
          icon={(category?.icon as IconName) ?? (transaction.kind === "adjustment" ? "target" : cardPayment ? "credit-card" : "cart")}
          label={
            category
              ? categoryLabel(category)
              : transaction.kind === "adjustment"
                ? t("transactions.list.reconciliation")
                : cardPayment
                  ? t("transactions.list.cardPayment")
                  : transaction.kind === "transfer"
                    ? t("transactions.list.transfer")
                    : t("transactions.detail.noCategory")
          }
          meta={t("transactions.detail.category")}
          variant="value"
        />
        <ListRow
          icon="wallet"
          label={account ? `${account.name} · ${account.currencyCode}` : "—"}
          meta={counterAccount ? t("transactions.detail.toAccount", { account: counterAccount.name }) : t("transactions.detail.account")}
          variant="value"
        />
        <ListRow icon="calendar" label={new Date(transaction.occurredAt).toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" })} meta={t("transactions.detail.date")} variant="value" />
        {tagNames.length > 0 ? <ListRow icon="tag" label={tagNames.join(", ")} meta={t("transactions.detail.tags")} variant="value" /> : null}
        {payee ? <ListRow icon="tag" label={payee.name} meta={t("transactions.detail.payee")} variant="value" /> : null}
        {transaction.note ? <ListRow icon="edit" label={transaction.note} meta={t("transactions.detail.note")} variant="value" /> : null}
        {cardPayment && counterAccount ? (
          <ListRow icon="credit-card" label={t("transactions.detail.cardStatement")} onClick={() => router.push(`/accounts/${counterAccount.id}/card`)} />
        ) : null}
      </div>

      {transaction.currencyCode !== household.baseCurrency ? (
        <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="t-label" style={{ color: "var(--text-secondary)" }}>
            {t("transactions.detail.fxRateUsed")}
          </span>
          {transaction.fxRate !== null ? (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--text-primary)" }}>
              {`1 ${transaction.currencyCode} = ${formatRateTrimmed(transaction.fxRate)} ${household.baseCurrency}`}
            </span>
          ) : (
            <StatusBadge status="neutral">{t("transactions.detail.fxUnresolved")}</StatusBadge>
          )}
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {t(FX_SOURCE_MESSAGE_KEY[transaction.fxSource])}
            {transaction.fxProvider ? ` · ${transaction.fxProvider}` : ""}
          </span>
          {transaction.fxRate === null ? (
            <Button variant="secondary" onClick={() => void openResolveFx()} style={{ marginTop: 4 }}>
              {t("transactions.detail.resolveFx")}
            </Button>
          ) : null}
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
        <ListRow icon="clock" label={t("transactions.detail.recurring")} onClick={() => router.push(`/recurring/new?fromTransaction=${transaction.id}`)} />
        <ListRow icon="chart" label={t("transactions.detail.split")} onClick={() => router.push(`/transactions/${transaction.id}/split`)} />
        <ListRow icon="trash" label={t("transactions.detail.delete")} destructive onClick={handleDelete} />
      </div>

      <Sheet
        open={resolveOpen}
        title={`${transaction.currencyCode} → ${household.baseCurrency}`}
        onClose={() => {
          setResolveOpen(false);
          setResolveKeypadDigits(null);
        }}
        height="auto"
      >
        {resolveKeypadDigits !== null ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-hero-size)", lineHeight: "var(--text-hero-line)", fontWeight: 600, marginTop: 4 }}>
                {resolveKeypadDigits === "" ? "0" : resolveKeypadDigits}
              </div>
            </div>
            {/* Sin operadores: un tipo de cambio no se suma ni se multiplica. */}
            <Keypad operators={false} onKey={(key) => setResolveKeypadDigits((d) => appendKeypadRateDigit(d ?? "", key, decimalSeparator))} onClear={() => setResolveKeypadDigits("")} />
            <div style={{ display: "flex", gap: 12 }}>
              <Button variant="secondary" onClick={() => setResolveKeypadDigits(null)}>
                {t("currenciesPage.keypadCancel")}
              </Button>
              <Button variant="primary" onClick={commitResolveKeypad} disabled={parseKeypadRate(resolveKeypadDigits, decimalSeparator) === null}>
                {t("currenciesPage.keypadDone")}
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <FxEditor from={transaction.currencyCode} to={household.baseCurrency} rate={resolveRate} onChange={setResolveRate} onOpenKeypad={openResolveKeypad} />
            <Button variant="primary" onClick={() => void applyResolveFx()} disabled={resolving}>
              {t("transactions.detail.confirmResolveFx")}
            </Button>
          </div>
        )}
      </Sheet>
      </div>
  );
}
