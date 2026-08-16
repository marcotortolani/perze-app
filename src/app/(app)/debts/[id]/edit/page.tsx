"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, EmptyState, Input, ListRow, SegmentedControl, Sheet, Skeleton, Switch, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useDebt, useDebtSchedule, useInvalidateDebt, useInvalidateDebts } from "@/hooks/use-debts";
import { debtsRepo, type AmortizationSystem } from "@/lib/repos/debts-repo";

/**
 * G5 — editar una deuda existente: nombre, cuenta vinculada, tasa,
 * sistema de amortización y cantidad de cuotas. No se edita capital ni
 * fecha de inicio: si ya hay cuotas pagadas, esos dos valores son la
 * base sobre la que se calculó lo que ya se pagó, y tocarlos rompería el
 * historial — mismo principio que `fx_rate` nunca se recalcula. Guardar
 * regenera las cuotas PENDIENTES en `debtsRepo.update()`; las pagadas
 * quedan intactas.
 */
export default function EditDebtPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const router = useRouter();
  usePageHeader({ title: t("debtDetailPage.editDebt"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });
  const { data: household } = useCurrentHousehold();
  const { data: debt, isLoading: debtLoading } = useDebt(id);
  const { data: schedule, isLoading: scheduleLoading } = useDebtSchedule(id);
  const { data: accounts = [] } = useAccounts(household?.id);
  const invalidateDebts = useInvalidateDebts(household?.id);
  const invalidateDebt = useInvalidateDebt(id);

  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [accountIdOverride, setAccountIdOverride] = useState<string | null | undefined>(undefined);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [hasInterestOverride, setHasInterestOverride] = useState<boolean | null>(null);
  const [interestRateExprOverride, setInterestRateExprOverride] = useState<string | null>(null);
  const [amortizationSystemOverride, setAmortizationSystemOverride] = useState<AmortizationSystem | null>(null);
  const [installmentsOverride, setInstallmentsOverride] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      setNameOverride(null);
      setAccountIdOverride(undefined);
      setHasInterestOverride(null);
      setInterestRateExprOverride(null);
      setAmortizationSystemOverride(null);
      setInstallmentsOverride(null);
      setSaving(false);
    };
  }, []);

  const paidCount = useMemo(() => (schedule ?? []).filter((item) => item.paidAt !== null).length, [schedule]);
  const hasPaidInstallments = paidCount > 0;

  if (debtLoading || scheduleLoading || !household) return <Skeleton height={300} style={{ marginTop: 16 }} />;
  if (!debt) return <EmptyState message={t("debtDetailPage.notFound")} actionLabel={t("recurringPage.back")} onAction={() => router.push("/debts")} />;

  const name = nameOverride ?? debt.name;
  const accountId = accountIdOverride === undefined ? debt.accountId : accountIdOverride;
  const account = accounts.find((a) => a.id === accountId);
  const hasInterest = hasInterestOverride ?? (debt.interestRate !== null && debt.interestRate > 0);
  const interestRateExpr = interestRateExprOverride ?? (debt.interestRate !== null ? String(debt.interestRate) : "");
  const amortizationSystem = amortizationSystemOverride ?? (debt.amortizationSystem === "none" ? "french" : debt.amortizationSystem);
  const installmentsExpr = installmentsOverride ?? (debt.installmentCount !== null ? String(debt.installmentCount) : "");
  const canSave = name.trim() !== "" && (!hasInterest || interestRateExpr.trim() !== "") && (debt.installmentCount === null || installmentsExpr.trim() !== "");

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const interestRate = hasInterest ? Number(interestRateExpr.replace(",", ".")) || 0 : null;
      const effectiveSystem: AmortizationSystem = hasInterest && interestRate && interestRate > 0 ? amortizationSystem : "none";
      const installmentsCount = debt.installmentCount !== null ? Math.max(paidCount + 1, Number(installmentsExpr) || debt.installmentCount) : undefined;

      await debtsRepo.update(debt.id, {
        name: name.trim(),
        accountId,
        interestRate,
        amortizationSystem: effectiveSystem,
        ...(installmentsCount !== undefined ? { installments: installmentsCount } : {}),
      });
      invalidateDebts();
      invalidateDebt();
      toast(t("debtDetailPage.updated"));
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 16, gap: 16, paddingBottom: 24 }}>
        <Input label={t("debtsPage.name")} placeholder={t("debtsPage.namePlaceholder")} value={name} onChange={(e) => setNameOverride(e.target.value)} />

        <button type="button" onClick={() => setAccountSheetOpen(true)} style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("debtsPage.linkedAccount")}</div>
          <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{account ? account.name : t("debtsPage.noLinkedAccount")}</div>
        </button>

        {debt.installmentCount !== null ? (
          <Input
            label={t("debtsPage.installmentCount")}
            hint={hasPaidInstallments ? t("debtDetailPage.editInstallmentsHint", { paid: paidCount }) : undefined}
            placeholder="12"
            value={installmentsExpr}
            onChange={(e) => setInstallmentsOverride(e.target.value.replace(/\D/g, ""))}
          />
        ) : null}

        <div className="flex items-center justify-between" style={{ background: "var(--surface-2)", borderRadius: "var(--radius-card)", padding: 14 }}>
          <div id="debt-edit-has-interest-label" style={{ color: "var(--text-primary)", fontSize: 15 }}>{t("debtsPage.hasInterest")}</div>
          <Switch checked={hasInterest} onChange={setHasInterestOverride} id="debt-edit-has-interest-label" />
        </div>

        {hasInterest ? (
          <>
            <Input label={t("debtsPage.annualRate")} placeholder="60" value={interestRateExpr} onChange={(e) => setInterestRateExprOverride(e.target.value.replace(/[^\d,.]/g, ""))} />
            <SegmentedControl
              options={[
                { id: "french", label: t("debtsPage.systemFrench") },
                { id: "german", label: t("debtsPage.systemGerman") },
              ]}
              value={amortizationSystem}
              onChange={(sysId) => setAmortizationSystemOverride(sysId as AmortizationSystem)}
            />
          </>
        ) : null}

        {hasPaidInstallments ? (
          <p className="t-caption" style={{ color: "var(--text-muted)" }}>{t("debtDetailPage.editFrozenNotice", { paid: paidCount })}</p>
        ) : null}

        <div style={{ marginTop: "auto" }}>
          <Button disabled={!canSave || saving} onClick={handleSave}>
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
