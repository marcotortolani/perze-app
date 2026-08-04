"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button, Skeleton, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { buildHouseholdExport, countHouseholdExport, stringifyHouseholdExport, type HouseholdExportCounts } from "@/lib/export/export-household";
import { todayIso } from "@/lib/dates/today";

const ROW_KEYS: (keyof HouseholdExportCounts)[] = ["transactions", "accounts", "categories", "tags", "payees", "budgets", "goals", "recurringRules"];

/** K10 — exportar y backup. Backup completo en JSON de lo local-first; sin reimportación (K9 no se programó esta versión). */
export default function ExportPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const countsQuery = useQuery({
    queryKey: ["export-counts", household?.id],
    queryFn: () => countHouseholdExport(household!.id),
    enabled: !!household,
  });
  const [exporting, setExporting] = useState(false);
  usePageHeader({ title: t("exportPage.headerTitle"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  if (!household || !countsQuery.data) return <Skeleton height={300} style={{ marginTop: 16 }} />;
  const counts = countsQuery.data;

  const handleExport = async () => {
    setExporting(true);
    try {
      const payload = await buildHouseholdExport(household.id);
      const json = stringifyHouseholdExport(payload);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `perze-backup-${household.name.toLowerCase().replace(/\s+/g, "-")}-${todayIso()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: 10 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 22, lineHeight: "28px", fontWeight: 600, letterSpacing: "-.01em", color: "var(--text-primary)" }}>
          {t("exportPage.title")}
        </div>
        <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 8 }}>{t("exportPage.subtitle")}</p>
      </div>

      <div style={{ paddingTop: 24, flex: 1 }}>
        <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("exportPage.whatsIncluded")}</div>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
          {ROW_KEYS.map((key) => (
            <div key={key} style={{ display: "flex", gap: 12, font: "400 15px/24px var(--font-sans)", color: "var(--text-secondary)" }}>
              <span style={{ flex: 1 }}>{t(`exportPage.rows.${key}`)}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>{counts[key]}</span>
            </div>
          ))}
        </div>
        <p className="t-caption" style={{ color: "var(--text-muted)", marginTop: 14 }}>{t("exportPage.notIncluded")}</p>
      </div>

      <div style={{ paddingBottom: 24 }}>
        <Button onClick={handleExport} disabled={exporting}>
          {t("exportPage.download")}
        </Button>
      </div>
    </div>
  );
}
