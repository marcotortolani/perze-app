"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, NeedsFxBanner, Skeleton, StatTile, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useTransactions } from "@/hooks/use-transactions";
import { usePriceIndex } from "@/hooks/use-price-index";
import { previousClosedPeriodBounds, monthsOfHistory } from "@/lib/analytics/history";
import { summarizePeriod } from "@/lib/analytics/period-summary";
import { adjustForInflation, inflationBetween } from "@/lib/analytics/inflation";
import { formatAmountCompact, formatNumber } from "@/lib/money/format";
import { money } from "@/lib/money/money";

const MIN_MONTHS = 2;

function periodKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** H7 — inflación: gasto nominal del período vs. en pesos de hoy. Sin ajuste hasta que exista un feed real de `price_index` — nunca se inventa el índice. */
export default function InflationPage() {
  const t = useTranslations();
  const router = useRouter();
  usePageHeader({ title: t("inflationPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });
  const { data: household } = useCurrentHousehold();
  const { data: transactions } = useTransactions(household?.id);
  const priceIndexQuery = usePriceIndex(household?.baseCurrency);

  const firstOccurredAt = (transactions ?? []).reduce<string | undefined>((min, tx) => (min === undefined || tx.occurredAt < min ? tx.occurredAt : min), undefined);
  const historyMonths = household ? monthsOfHistory(firstOccurredAt, new Date()) : 0;

  const summary = useMemo(() => {
    if (!household || !transactions) return null;
    const { start, end } = previousClosedPeriodBounds(household.periodStartDay || 1, new Date());
    return { ...summarizePeriod(transactions, start, end), period: periodKey(start) };
  }, [household, transactions]);

  if (!household || !transactions || priceIndexQuery.isLoading) return <Skeleton height={220} style={{ marginTop: 16 }} />;

  if (historyMonths < MIN_MONTHS || !summary) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <EmptyState message={t("inflationPage.needsHistory", { months: Math.max(0, MIN_MONTHS - historyMonths) })} />
      </div>
    );
  }

  const indexPoints = (priceIndexQuery.data ?? []).map((p) => ({ period: p.period.slice(0, 7), indexValue: p.indexValue }));
  const adjusted = adjustForInflation(summary.expenseTotal, summary.period, indexPoints);
  const latestPeriod = [...indexPoints].sort((a, b) => b.period.localeCompare(a.period))[0]?.period;
  const pctChange = latestPeriod ? inflationBetween(summary.period, latestPeriod, indexPoints) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {summary.excludedCount > 0 ? (
        <NeedsFxBanner
          count={summary.excludedCount}
          onResolve={() => router.push("/accounts/resolve-fx")}
          style={{ margin: "0 calc(-1 * var(--screen-padding))", borderRadius: 0 }}
        />
      ) : null}
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", gap: 16 }}>
          <StatTile label={t("inflationPage.nominal")} value={formatAmountCompact(money(summary.expenseTotal, household.baseCurrency), { showSign: false })} style={{ flex: 1 }} />
          {adjusted !== null ? (
            <StatTile label={t("inflationPage.adjusted")} value={formatAmountCompact(money(adjusted, household.baseCurrency), { showSign: false })} style={{ flex: 1 }} />
          ) : null}
        </div>
        {adjusted !== null && pctChange !== null ? (
          <p className="t-body" style={{ color: "var(--text-secondary)" }}>
            {t("inflationPage.explainer", { percent: formatNumber(pctChange, 1) })}
          </p>
        ) : (
          <p className="t-body" style={{ color: "var(--text-muted)" }}>{t("inflationPage.noIndex")}</p>
        )}
      </div>
    </div>
  );
}
