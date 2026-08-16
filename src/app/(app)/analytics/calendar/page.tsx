"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { NeedsFxBanner, Skeleton, usePageHeader } from "@/design-system";
import { CalendarHeatmap } from "@/design-system/charts";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useTransactions } from "@/hooks/use-transactions";

const DAYS = 90;

/** H8 — calendario, heatmap de intensidad de gasto de los últimos 90 días. */
export default function CalendarHeatmapPage() {
  const t = useTranslations();
  const router = useRouter();
  usePageHeader({ title: t("calendarAnalyticsPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });
  const { data: household } = useCurrentHousehold();
  const { data: transactions } = useTransactions(household?.id);

  const { days, excludedCount } = useMemo(() => {
    if (!transactions) return { days: [], excludedCount: 0 };
    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DAYS - 1)).toISOString().slice(0, 10);
    const byDay = new Map<string, bigint>();
    let exCount = 0;
    for (const tx of transactions) {
      if (tx.kind !== "expense") continue;
      const day = tx.occurredAt.slice(0, 10);
      if (day < cutoff) continue;
      if (tx.amountBase === null) {
        exCount += 1;
        continue;
      }
      byDay.set(day, (byDay.get(day) ?? 0n) + tx.amountBase);
    }
    const days = Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DAYS - 1 - i));
      const iso = d.toISOString().slice(0, 10);
      return { date: iso, value: Number(byDay.get(iso) ?? 0n) };
    });
    return { days, excludedCount: exCount };
  }, [transactions]);

  if (!household || !transactions) return <Skeleton height={300} style={{ marginTop: 16 }} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <NeedsFxBanner
        count={excludedCount}
        onResolve={() => router.push("/accounts/resolve-fx")}
        style={{ margin: "0 calc(-1 * var(--screen-padding))", borderRadius: 0 }}
      />
      <div style={{ paddingTop: 24 }}>
        <CalendarHeatmap days={days} rows="year" />
      </div>
    </div>
  );
}
