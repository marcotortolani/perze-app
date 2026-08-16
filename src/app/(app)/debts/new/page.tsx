"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Button, Input, Keypad, ListRow, SegmentedControl, Sheet, Switch, usePageHeader, ZMark } from "@/design-system";
import { decimalSeparatorForLocale, numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useAccounts } from "@/hooks/use-accounts";
import { useTransaction } from "@/hooks/use-transactions";
import { useCategories } from "@/hooks/use-categories";
import { useInvalidateDebts } from "@/hooks/use-debts";
import { debtsRepo, type DebtKind } from "@/lib/repos/debts-repo";
import { generateSchedule, type AmortizationSystem } from "@/lib/analytics/installment-schedule";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import { toMajorUnitsUnsafe, money } from "@/lib/money/money";
import { todayIso } from "@/lib/repos/ids";
import { DEBT_KIND_MESSAGE_KEY } from "@/lib/reference/debt-labels";

const KINDS: DebtKind[] = ["installment_plan", "loan", "personal", "credit_line"];

/**
 * G6/G6a — nueva deuda o plan de cuotas. Default: cuota pareja de
 * capital, sin interés (`none`) — el caso más común, cero fricción
 * nueva. El interés es una casilla opcional que revela la tasa anual y
 * el sistema de amortización (`french` por default, `german` como
 * alternativa) — ver `installment-schedule.ts`. Con `?fromTransaction=`
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
  const userId = useEffectiveUserId();
  const { data: accounts = [] } = useAccounts(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const { data: sourceTransaction } = useTransaction(fromTransactionId);
  const invalidateDebts = useInvalidateDebts(household?.id);
  usePageHeader({ title: t("debtsPage.newDebt"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  const [kind, setKind] = useState<DebtKind>("installment_plan");
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [exprOverride, setExprOverride] = useState<string | null>(null);
  const [installments, setInstallments] = useState("12");
  const [accountIdOverride, setAccountIdOverride] = useState<string | null | undefined>(undefined);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // El interés es una casilla opcional que revela lo demás — el default
  // no cambia (cuotas parejas, sin interés) hasta que se activa. `french`
  // es el default al activarla: es el sistema de casi todo préstamo real.
  const [hasInterest, setHasInterest] = useState(false);
  const [interestRateExpr, setInterestRateExpr] = useState("");
  const [amortizationSystem, setAmortizationSystem] = useState<AmortizationSystem>("french");

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
  const interestRate = hasInterest ? Number(interestRateExpr.replace(",", ".")) || 0 : null;
  const effectiveSystem: AmortizationSystem = hasInterest && interestRate && interestRate > 0 ? amortizationSystem : "none";
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
        interestRate,
        termMonths: kind === "installment_plan" ? installmentCount : null,
        startDate: todayIso(),
        counterpart: null,
        direction: "owe",
        originTransactionId: fromTransactionId ?? null,
        installmentCount: kind === "installment_plan" ? installmentCount : null,
        amortizationSystem: effectiveSystem,
        createdBy: userId,
      });
      if (kind === "installment_plan") {
        const schedule = generateSchedule(effectiveSystem, { principal: principal.amount, installments: installmentCount, startDate, annualRatePct: interestRate });
        await debtsRepo.createSchedule(schedule.map((s) => ({ debtId: debt.id, dueDate: s.dueDate, number: s.number, principalAmount: s.principalAmount, interestAmount: s.interestAmount, paidAt: null, transactionId: null })));
      }
      invalidateDebts();
      toast(t("debtsPage.created"));
      // `back()`, no `replace`/`push` — se llega acá con push desde la
      // lista o desde la tarjeta, que ya está en el historial justo
      // debajo en cualquiera de los dos casos. `replace("/debts")`
      // duplicaba esa entrada, y además ignoraba el caso "vengo de la
      // tarjeta" (siempre mandaba a la lista). `back()` vuelve a donde
      // realmente se estaba, sea cual sea.
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* `lg`+: el formulario (pocos campos, sin scroll) queda a la
          izquierda tal cual estaba — la columna del grid ya da un ancho
          parecido a `--content-max-width`, no hace falta un techo aparte —
          y la derecha pasa a llevar el `ZMark` en vez de quedar vacía. */}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ flex: 1, minHeight: 0, gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", paddingTop: 16, gap: 16 }}>
          <SegmentedControl options={KINDS.map((k) => ({ id: k, label: t(DEBT_KIND_MESSAGE_KEY[k]) }))} value={kind} onChange={(id) => setKind(id as DebtKind)} />
          <Input label={t("debtsPage.name")} placeholder={t("debtsPage.namePlaceholder")} value={name} onChange={(e) => setNameOverride(e.target.value)} />
          {kind === "installment_plan" ? (
            <Input label={t("debtsPage.installmentCount")} placeholder="12" value={installments} onChange={(e) => setInstallments(e.target.value.replace(/\D/g, ""))} />
          ) : null}

          <button type="button" onClick={() => setAccountSheetOpen(true)} style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("debtsPage.linkedAccount")}</div>
            <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{account ? account.name : t("goalsPage.chooseAccount")}</div>
          </button>

          <div className="flex items-center justify-between" style={{ background: "var(--surface-2)", borderRadius: "var(--radius-card)", padding: 14 }}>
            <div id="debt-has-interest-label" style={{ color: "var(--text-primary)", fontSize: 15 }}>{t("debtsPage.hasInterest")}</div>
            <Switch checked={hasInterest} onChange={setHasInterest} id="debt-has-interest-label" />
          </div>

          {hasInterest ? (
            <>
              <Input
                label={t("debtsPage.annualRate")}
                placeholder="60"
                value={interestRateExpr}
                onChange={(e) => setInterestRateExpr(e.target.value.replace(/[^\d,.]/g, ""))}
              />
              <SegmentedControl
                options={[
                  { id: "french", label: t("debtsPage.systemFrench") },
                  { id: "german", label: t("debtsPage.systemGerman") },
                ]}
                value={amortizationSystem}
                onChange={(id) => setAmortizationSystem(id as AmortizationSystem)}
              />
            </>
          ) : null}

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

        <div className="hidden lg:flex" style={{ alignItems: "center", justifyContent: "center" }}>
          <ZMark variant="flip" animated size={28} gap={8} aria-label={t("app.name")} />
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
