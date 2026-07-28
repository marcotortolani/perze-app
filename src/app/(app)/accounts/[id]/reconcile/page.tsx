"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Amount, Button, EmptyState, Icon, Keypad, Skeleton } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccount, useInvalidateAccounts } from "@/hooks/use-accounts";
import { useInvalidateTransactions } from "@/hooks/use-transactions";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import { money, subtract } from "@/lib/money/money";
import { transactionsRepo } from "@/lib/repos/transactions-repo";
import { todayIso } from "@/lib/repos/ids";
import { DEMO_USER_ID } from "@/lib/demo-user";

/** E5 — conciliación: "¿cuánto dice tu banco que tenés?" → diferencia → ajuste. Bloque E, Fase 8. */
export default function ReconcileAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: account, isLoading } = useAccount(id);
  const invalidateAccounts = useInvalidateAccounts(household?.id);
  const invalidateTransactions = useInvalidateTransactions(household?.id);
  const [expr, setExpr] = useState("");
  const [saving, setSaving] = useState(false);

  if (isLoading || !household) return <Skeleton height={300} />;
  if (!account) return <EmptyState icon="alert" message={t("accountsPage.reconcile.notFound")} actionLabel={t("accountsPage.reconcile.back")} onAction={() => router.push("/accounts")} />;

  const bankBalance = evaluateKeypadExpression(expr || "0", account.currencyCode);
  const currentBalance = money(account.currentBalance, account.currencyCode);
  const diff = subtract(bankBalance, currentBalance);
  const hasDiff = expr.trim() !== "" && diff.amount !== 0n;

  const handleConfirm = async () => {
    if (!hasDiff || saving) return;
    setSaving(true);
    try {
      await transactionsRepo.create({
        householdId: household.id,
        createdBy: DEMO_USER_ID,
        kind: "adjustment",
        occurredAt: new Date().toISOString(),
        accountId: account.id,
        counterAccountId: null,
        amount: diff.amount,
        currencyCode: account.currencyCode,
        fxRate: account.currencyCode === household.baseCurrency ? null : null,
        fxSource: account.currencyCode === household.baseCurrency ? "identity" : "pending",
        fxProvider: null,
        fxQuoteKind: null,
        fxResolvedAt: account.currencyCode === household.baseCurrency ? todayIso() : null,
        amountBase: account.currencyCode === household.baseCurrency ? diff.amount : null,
        counterAmount: null,
        counterCurrencyCode: null,
        counterFxRate: null,
        categoryId: null,
        payeeId: null,
        note: t("accountsPage.reconcile.adjustmentNote"),
        attachments: [],
        location: null,
        status: "cleared",
        visibility: account.visibility,
        recurringId: null,
        installmentGroupId: null,
        installmentNumber: null,
        installmentTotal: null,
        source: "manual",
      });
      invalidateAccounts();
      invalidateTransactions();
      router.push(`/accounts/${account.id}`);
      toast(t("accountsPage.reconcile.reconciled"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 16, paddingBottom: 24, minHeight: "100%" }}>
      <button type="button" onClick={() => router.back()} aria-label={t("accountsPage.reconcile.back")} style={{ alignSelf: "flex-start", background: "none", border: 0, padding: 4, margin: -4, cursor: "pointer" }}>
        <Icon name="chevron-left" size={22} color="var(--text-secondary)" />
      </button>

      <div style={{ textAlign: "center" }}>
        <span className="t-label" style={{ color: "var(--text-secondary)" }}>{t("accountsPage.reconcile.prompt", { account: account.name })}</span>
        <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 32 }}>
          {account.currencyCode} {expr || "0"}
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-muted)" }}>
          {t("accountsPage.reconcile.yourRecord")} <Amount value={currentBalance} size="label" showSign={false} polarity="neutral" tabular />
        </div>
        {hasDiff ? (
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 14, color: diff.amount > 0n ? "var(--money-positive)" : "var(--money-negative-emphasis)" }}>
              {t("accountsPage.reconcile.difference")} <Amount value={diff} size="label" tabular />
            </span>
          </div>
        ) : null}
      </div>

      <Keypad onKey={(k) => setExpr((s) => (k === "backspace" ? s.slice(0, -1) : s + (k === "," ? "," : k)))} onClear={() => setExpr("")} />

      <div style={{ marginTop: "auto" }}>
        <Button disabled={!hasDiff || saving} onClick={handleConfirm}>
          {hasDiff ? t("accountsPage.reconcile.createAdjustment") : t("accountsPage.reconcile.noDifference")}
        </Button>
      </div>
    </div>
  );
}
