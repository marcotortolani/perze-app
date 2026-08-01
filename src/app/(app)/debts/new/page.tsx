"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader, Button, Input, Keypad, ListRow, SegmentedControl, Sheet } from "@/design-system";
import { decimalSeparatorForLocale, numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { useAccounts } from "@/hooks/use-accounts";
import { useTransaction } from "@/hooks/use-transactions";
import { useCategories } from "@/hooks/use-categories";
import { useInvalidateDebts } from "@/hooks/use-debts";
import { debtsRepo, type DebtKind } from "@/lib/repos/debts-repo";
import { generateEvenSchedule } from "@/lib/analytics/installment-schedule";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import { toMajorUnitsUnsafe, money } from "@/lib/money/money";
import { todayIso } from "@/lib/repos/ids";
import { DEBT_KIND_MESSAGE_KEY } from "@/lib/reference/debt-labels";

const KINDS: DebtKind[] = ["installment_plan", "loan", "personal", "credit_line"];

/**
 * G6/G6a — nueva deuda o plan de cuotas. Sin amortización real: cuota
 * pareja, el resto de la división cae en la última. Con `?fromTransaction=`
 * (G6a, el picker vive en la pantalla de la cuenta de tarjeta) prefila
 * nombre, monto, cuenta y fecha desde ese movimiento y lo vincula como
 * `originTransactionId`.
 */
export default function NewDebtPage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromTransactionId = searchParams.get("fromTransaction") ?? undefined;
  const { data: household } = useCurrentHousehold();
  const userId = useCurrentUserId();
  const { data: accounts = [] } = useAccounts(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const { data: sourceTransaction } = useTransaction(fromTransactionId);
  const invalidateDebts = useInvalidateDebts(household?.id);

  const [kind, setKind] = useState<DebtKind>("installment_plan");
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [exprOverride, setExprOverride] = useState<string | null>(null);
  const [installments, setInstallments] = useState("12");
  const [accountIdOverride, setAccountIdOverride] = useState<string | null | undefined>(undefined);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const sourceCategory = useMemo(() => (sourceTransaction?.categoryId ? categories.find((c) => c.id === sourceTransaction.categoryId) : undefined), [sourceTransaction, categories]);

  // Prefill desde `sourceTransaction` (G6a) — derivado, no un efecto:
  // evita el round-trip de setState en un useEffect (ver CLAUDE.md,
  // patrón ya usado en split/page.tsx y goals/[id]/page.tsx).
  const defaultName = sourceTransaction ? (sourceCategory?.name ?? t("debtsPage.fromTransactionDefaultName")) : "";
  const defaultExpr = sourceTransaction ? String(toMajorUnitsUnsafe(money(sourceTransaction.amount, sourceTransaction.currencyCode))).replace(".", decimalSeparatorForLocale(locale)) : "";
  const defaultAccountId = sourceTransaction?.accountId ?? null;

  if (!household || !userId) return null;

  const name = nameOverride ?? defaultName;
  const expr = exprOverride ?? defaultExpr;
  const accountId = accountIdOverride === undefined ? defaultAccountId : accountIdOverride;
  const account = accounts.find((a) => a.id === accountId);
  const installmentCount = Math.max(1, Number(installments) || 1);
  const canSave = name.trim() !== "" && expr.trim() !== "";

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const principal = evaluateKeypadExpression(expr, household.baseCurrency, numberLocaleForUiLocale(locale));
      const startDate = new Date();
      const debt = await debtsRepo.create({
        householdId: household.id,
        accountId,
        kind,
        name: name.trim(),
        principal: principal.amount,
        currencyCode: household.baseCurrency,
        interestRate: null,
        termMonths: kind === "installment_plan" ? installmentCount : null,
        startDate: todayIso(),
        counterpart: null,
        direction: "owe",
        originTransactionId: fromTransactionId ?? null,
        installmentCount: kind === "installment_plan" ? installmentCount : null,
        createdBy: userId,
      });
      if (kind === "installment_plan") {
        const schedule = generateEvenSchedule(principal.amount, installmentCount, startDate);
        await debtsRepo.createSchedule(schedule.map((s) => ({ debtId: debt.id, dueDate: s.dueDate, number: s.number, principalAmount: s.principalAmount, interestAmount: s.interestAmount, paidAt: null, transactionId: null })));
      }
      invalidateDebts();
      toast(t("debtsPage.created"));
      router.push("/debts");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("debtsPage.newDebt")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 16, gap: 16 }}>
        <SegmentedControl options={KINDS.map((k) => ({ id: k, label: t(DEBT_KIND_MESSAGE_KEY[k]) }))} value={kind} onChange={(id) => setKind(id as DebtKind)} />
        <Input label={t("debtsPage.name")} placeholder={t("debtsPage.namePlaceholder")} value={name} onChange={(e) => setNameOverride(e.target.value)} />
        {kind === "installment_plan" ? (
          <Input label={t("debtsPage.installmentCount")} placeholder="12" value={installments} onChange={(e) => setInstallments(e.target.value.replace(/\D/g, ""))} />
        ) : null}

        <button type="button" onClick={() => setAccountSheetOpen(true)} style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("debtsPage.linkedAccount")}</div>
          <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{account ? account.name : t("goalsPage.chooseAccount")}</div>
        </button>

        <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 32 }}>
          {household.baseCurrency} {expr || "0"}
        </div>

        <div style={{ marginTop: "auto" }}>
          <Keypad onKey={(k) => setExprOverride((s) => { const cur = s ?? expr; return k === "clear" ? "" : k === "backspace" ? cur.slice(0, -1) : cur + (k === "," ? "," : k); })} onClear={() => setExprOverride("")} />
          <Button disabled={!canSave || saving} onClick={handleSave} style={{ marginTop: 16 }}>
            {t("common.save")}
          </Button>
        </div>
      </div>

      <Sheet open={accountSheetOpen} title={t("goalsPage.chooseAccount")} onClose={() => setAccountSheetOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <ListRow label={t("debtsPage.noLinkedAccount")} onClick={() => { setAccountIdOverride(null); setAccountSheetOpen(false); }} />
          {accounts.map((a) => (
            <ListRow key={a.id} label={a.name} meta={a.currencyCode} onClick={() => { setAccountIdOverride(a.id); setAccountSheetOpen(false); }} />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
