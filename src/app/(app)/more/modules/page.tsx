"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppHeader, Button, Sheet, Skeleton, Switch } from "@/design-system";
import { useCurrentHousehold, useInvalidateHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useTransactions } from "@/hooks/use-transactions";
import { householdsRepo } from "@/lib/repos/households-repo";
import { useHouseholdMembers } from "@/hooks/use-household-members";
import type { EnabledModule } from "@/lib/db/schema";

const MODULE_ORDER: EnabledModule[] = ["budgets", "goals", "recurring", "debts", "investments", "family"];

/** A9 — Ajustes → Módulos. Apagar oculta, nunca borra; la advertencia lleva números reales, nunca inventados. */
export default function ModulesPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const invalidateHousehold = useInvalidateHousehold();
  const { data: accounts } = useAccounts(household?.id);
  const { data: transactions } = useTransactions(household?.id);
  const { data: members } = useHouseholdMembers(household?.id);
  const [confirmModule, setConfirmModule] = useState<EnabledModule | null>(null);

  const usage = useMemo(() => {
    const recurringCount = new Set((transactions ?? []).map((tx) => tx.recurringId).filter(Boolean)).size;
    const installmentCount = new Set((transactions ?? []).map((tx) => tx.installmentGroupId).filter(Boolean)).size;
    const debtAccounts = (accounts ?? []).filter((a) => a.kind === "loan" || a.kind === "receivable").length;
    const investmentAccounts = (accounts ?? []).filter((a) => a.kind === "broker").length;
    const otherMembers = Math.max((members ?? []).length - 1, 0);
    return {
      budgets: 0,
      goals: 0,
      recurring: recurringCount,
      debts: installmentCount + debtAccounts,
      investments: investmentAccounts,
      family: otherMembers,
    } satisfies Record<EnabledModule, number>;
  }, [transactions, accounts, members]);

  if (!household) {
    return (
      <div style={{ paddingTop: 16 }}>
        <Skeleton width="100%" height={60} style={{ marginBottom: 8 }} />
        <Skeleton width="100%" height={60} style={{ marginBottom: 8 }} />
        <Skeleton width="100%" height={60} />
      </div>
    );
  }

  const enabled = new Set(household.enabledModules);

  const setModule = async (module: EnabledModule, on: boolean) => {
    const next = on ? [...new Set([...household.enabledModules, module])] : household.enabledModules.filter((m) => m !== module);
    await householdsRepo.update(household.id, { enabledModules: next });
    invalidateHousehold();
  };

  const handleToggle = (module: EnabledModule, on: boolean) => {
    if (!on && usage[module] > 0) {
      setConfirmModule(module);
      return;
    }
    void setModule(module, on);
  };

  const confirmDisable = async () => {
    if (!confirmModule) return;
    await setModule(confirmModule, false);
    setConfirmModule(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("morePage.modules")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 12, gap: 4 }}>
        <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>
          {t("modulesPage.subtitle")}
        </p>
        <div style={{ height: 4 }} />
        {MODULE_ORDER.map((module) => (
          <div key={module} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 4px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, lineHeight: "24px", color: "var(--text-primary)" }}>{t(`modulesPage.modules.${module}.label`)}</div>
              <div style={{ fontSize: 13, lineHeight: "18px", color: "var(--text-secondary)" }}>{t(`modulesPage.modules.${module}.description`)}</div>
            </div>
            <Switch checked={enabled.has(module)} onChange={(on) => handleToggle(module, on)} id={`module-${module}`} />
          </div>
        ))}
        <div style={{ marginTop: "auto", paddingBottom: 24, fontSize: 13, color: "var(--text-secondary)" }}>{t("modulesPage.footnote")}</div>
      </div>

      <Sheet open={confirmModule !== null} title={t("modulesPage.confirmTitle")} onClose={() => setConfirmModule(null)} height={260}>
        {confirmModule ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p className="t-body" style={{ margin: 0, color: "var(--text-primary)" }}>
              {t(`modulesPage.confirmBody.${confirmModule}`, { count: usage[confirmModule] })}
            </p>
            <Button variant="danger" onClick={confirmDisable}>
              {t("modulesPage.confirmDisable")}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmModule(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
