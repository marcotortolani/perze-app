"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AppHeader, ListRow, Sheet, Skeleton } from "@/design-system";
import { useAccounts } from "@/hooks/use-accounts";
import { useCurrentHousehold, useInvalidateHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { useHouseholdMembers } from "@/hooks/use-household-members";
import { useTransactions } from "@/hooks/use-transactions";
import { householdsRepo } from "@/lib/repos/households-repo";
import { CURRENCIES } from "@/lib/reference/countries-currencies";
import { useNavStore, type FourthTab } from "@/stores/nav-store";

const FOURTH_TAB_MESSAGE_KEY = {
  analytics: "nav.analysis",
  accounts: "morePage.accounts",
  investments: "nav.investments",
  budgets: "morePage.budgets",
} as const satisfies Record<FourthTab, string>;

const CLOSE_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/** K3 — preferencias: cuarto slot del tab bar, día de cierre por household, moneda del hogar. */
export default function SettingsPage() {
  const t = useTranslations();
  const router = useRouter();
  const userId = useCurrentUserId();
  const { data: household } = useCurrentHousehold();
  const invalidateHousehold = useInvalidateHousehold();
  const { data: members } = useHouseholdMembers(household?.id);
  const { data: accounts } = useAccounts(household?.id);
  const { data: transactions } = useTransactions(household?.id);
  const fourthTab = useNavStore((s) => s.fourthTab);
  const setFourthTab = useNavStore((s) => s.setFourthTab);
  const [tabSheetOpen, setTabSheetOpen] = useState(false);
  const [closeDaySheetOpen, setCloseDaySheetOpen] = useState(false);
  const [baseCurrencySheetOpen, setBaseCurrencySheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const isMultiCurrency = useMemo(() => new Set((accounts ?? []).map((a) => a.currencyCode)).size > 1, [accounts]);
  const hasTransactions = (transactions?.length ?? 0) > 0;

  const tabOptions = useMemo<FourthTab[]>(() => {
    const modules = household?.enabledModules ?? [];
    const options: FourthTab[] = ["analytics", "accounts"];
    if (modules.includes("budgets")) options.push("budgets");
    if (modules.includes("investments")) options.push("investments");
    return options;
  }, [household]);

  if (!household) return <Skeleton height={200} style={{ marginTop: 16 }} />;

  const isOwnerOrAdmin = (members ?? []).some((m) => m.profileId === userId && (m.role === "owner" || m.role === "admin"));

  const handleCloseDay = async (day: number) => {
    setSaving(true);
    try {
      await householdsRepo.update(household.id, { periodStartDay: day });
      invalidateHousehold();
      setCloseDaySheetOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleBaseCurrency = async (currency: string) => {
    if (currency === household.baseCurrency) {
      setBaseCurrencySheetOpen(false);
      return;
    }
    setSaving(true);
    try {
      await householdsRepo.update(household.id, { baseCurrency: currency });
      invalidateHousehold();
      setBaseCurrencySheetOpen(false);
      toast(t("settingsPage.baseCurrencyChanged", { currency }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("morePage.settings")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
        <ListRow
          icon="wallet"
          label={t(isMultiCurrency ? "settingsPage.baseCurrency" : "settingsPage.yourCurrency")}
          value={household.baseCurrency}
          variant="value"
          disabled={hasTransactions}
          onClick={() => !hasTransactions && setBaseCurrencySheetOpen(true)}
        />
        {hasTransactions ? (
          <p className="t-caption" style={{ color: "var(--text-muted)", padding: "0 4px" }}>{t("settingsPage.baseCurrencyLocked")}</p>
        ) : null}
        {isMultiCurrency ? <ListRow icon="refresh" label={t("settingsPage.fxSources")} onClick={() => router.push("/currencies")} /> : null}
        <ListRow
          icon="chart"
          label={t("settingsPage.fourthTab")}
          value={t(FOURTH_TAB_MESSAGE_KEY[fourthTab])}
          variant="value"
          onClick={() => setTabSheetOpen(true)}
        />
        <ListRow
          icon="calendar"
          label={t("settingsPage.closeDay")}
          value={String(household.periodStartDay)}
          variant="value"
          disabled={!isOwnerOrAdmin}
          onClick={() => isOwnerOrAdmin && setCloseDaySheetOpen(true)}
        />
        {!isOwnerOrAdmin ? (
          <p className="t-caption" style={{ color: "var(--text-muted)", padding: "0 4px" }}>{t("settingsPage.closeDayRestricted")}</p>
        ) : null}
      </div>

      <Sheet open={tabSheetOpen} title={t("settingsPage.fourthTab")} onClose={() => setTabSheetOpen(false)} height={280}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {tabOptions.map((option) => (
            <ListRow
              key={option}
              label={t(FOURTH_TAB_MESSAGE_KEY[option])}
              variant="value"
              value={option === fourthTab ? "✓" : undefined}
              onClick={() => {
                setFourthTab(option);
                setTabSheetOpen(false);
              }}
            />
          ))}
        </div>
      </Sheet>

      <Sheet open={baseCurrencySheetOpen} title={t(isMultiCurrency ? "settingsPage.baseCurrency" : "settingsPage.yourCurrency")} onClose={() => setBaseCurrencySheetOpen(false)} height={420}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <p className="t-body" style={{ margin: "0 0 8px", color: "var(--text-secondary)" }}>{t("settingsPage.baseCurrencyHint")}</p>
          {CURRENCIES.map((c) => (
            <ListRow
              key={c.code}
              label={c.name}
              meta={c.code}
              variant="value"
              value={c.code === household.baseCurrency ? "✓" : undefined}
              disabled={saving}
              onClick={() => handleBaseCurrency(c.code)}
            />
          ))}
        </div>
      </Sheet>

      <Sheet open={closeDaySheetOpen} title={t("settingsPage.closeDay")} onClose={() => setCloseDaySheetOpen(false)} height={420}>
        <div style={{ display: "flex", flexDirection: "column", overflowY: "auto", maxHeight: 380 }}>
          <p className="t-body" style={{ margin: "0 0 8px", color: "var(--text-secondary)" }}>{t("settingsPage.closeDayHint")}</p>
          {CLOSE_DAYS.map((day) => (
            <ListRow
              key={day}
              label={t("settingsPage.dayOfMonth", { day })}
              variant="value"
              value={day === household.periodStartDay ? "✓" : undefined}
              disabled={saving}
              onClick={() => handleCloseDay(day)}
            />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
