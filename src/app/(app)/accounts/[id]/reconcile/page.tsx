"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Amount, Button, EmptyState, Keypad, Skeleton, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccount, useInvalidateAccounts } from "@/hooks/use-accounts";
import { useInvalidateAfterTransactionWrite } from "@/hooks/use-transactions";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import { money } from "@/lib/money/money";
import { computeReconcileDiff } from "@/features/accounts/reconcile-diff";
import { transactionsRepo } from "@/lib/repos/transactions-repo";
import { resolveFxForAccountCurrency } from "@/features/capture/save-transaction";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";

/** E5 — conciliación: "¿cuánto dice tu banco que tenés?" → diferencia → ajuste. Bloque E, Fase 8. */
export default function ReconcileAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const userId = useEffectiveUserId();
  const { data: account, isLoading } = useAccount(id);
  const invalidateAccounts = useInvalidateAccounts(household?.id);
  const invalidateTransactions = useInvalidateAfterTransactionWrite(household?.id);
  const [expr, setExpr] = useState("");
  const [saving, setSaving] = useState(false);

  usePageHeader({ title: t("accountsPage.detail.reconcile"), onBack: () => router.back(), backLabel: t("accountsPage.reconcile.back") });

  if (isLoading || !household || !userId) {
    return <Skeleton height={300} />;
  }
  if (!account) {
    return <EmptyState message={t("accountsPage.reconcile.notFound")} actionLabel={t("accountsPage.reconcile.back")} onAction={() => router.push("/accounts")} />;
  }

  const bankBalance = evaluateKeypadExpression(expr || "0", account.currencyCode, numberLocaleForUiLocale(locale));
  const currentBalance = money(account.currentBalance, account.currencyCode);
  const { diff, hasDiff } = computeReconcileDiff({ bankBalance, currentBalance, expr });

  const handleConfirm = async () => {
    if (!hasDiff || saving) return;
    setSaving(true);
    try {
      // Un ajuste de conciliación no es una compra en otra moneda — es una
      // corrección del saldo, en la moneda de la cuenta, de punta a punta.
      // Igual necesita `amount_base` para entrar en agregados en la moneda
      // base del household, así que pasa por la MISMA cadena de resolución
      // (override → cotización del día → última conocida → `pending`) que
      // cualquier captura normal — nunca "identity o pending" a mano: eso
      // dejaba `pending` un ajuste aunque ya hubiera cotización disponible.
      const fx = await resolveFxForAccountCurrency(household, account.currencyCode, diff, new Date().toISOString().slice(0, 10));
      await transactionsRepo.create({
        householdId: household.id,
        createdBy: userId,
        kind: "adjustment",
        occurredAt: new Date().toISOString(),
        accountId: account.id,
        counterAccountId: null,
        amount: diff.amount,
        currencyCode: account.currencyCode,
        originalAmount: null,
        originalCurrency: null,
        originalRate: null,
        ...fx,
        counterAmount: null,
        counterCurrencyCode: null,
        counterFxRate: null,
        categoryId: null,
        payeeId: null,
        note: t("accountsPage.reconcile.adjustmentNote"),
        attachments: [],
        location: null,
        status: "cleared",
        // Las transacciones no admiten "custom" (solo la cuenta puede
        // serlo) — cae a "private" en vez de "household" para no filtrar
        // el movimiento a miembros que no tienen grant sobre la cuenta.
        visibility: account.visibility === "custom" ? "private" : account.visibility,
        recurringId: null,
        installmentGroupId: null,
        installmentNumber: null,
        installmentTotal: null,
        source: "manual",
      });
      invalidateAccounts();
      invalidateTransactions();
      // `back()`, no `replace`/`push` — esta pantalla se llegó con push
      // desde el detalle de la cuenta, que ya está en el historial justo
      // debajo. `replace` a esa MISMA url duplicaba la entrada (el
      // historial quedaba `[detalle, detalle]`) y "volver" necesitaba dos
      // toques. `back()` no agrega nada, solo recorre lo que ya existe.
      router.back();
      toast(t("accountsPage.reconcile.reconciled"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 16, paddingBottom: 24, minHeight: "100%" }}>
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
