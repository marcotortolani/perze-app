"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, NeedsFxBanner, Skeleton, StatTile, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useInstruments, useLatestPrices, usePortfolioFromParam, usePortfolios, useTrades } from "@/hooks/use-investments";
import { computePositions } from "@/lib/analytics/positions";
import { computePortfolioReturn } from "@/lib/analytics/portfolio-return";
import { fromMajorUnitsUnsafe } from "@/lib/money/money";
import { formatNumber } from "@/lib/money/format";

const MIN_DAYS = 30;

/** I10 — rendimiento del portfolio (XIRR). TWR y comparación con benchmarks/inflación quedan afuera: necesitan `portfolio_snapshots`/`benchmark_series`/`price_index` poblados por un feed que no existe todavía — ver nota en el código. */
export default function PerformancePage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: portfolios } = usePortfolios(household?.id);
  const portfolio = usePortfolioFromParam(portfolios);
  const { data: trades } = useTrades(portfolio?.id);
  const { data: instruments } = useInstruments(household?.id);
  const instrumentIds = useMemo(() => [...new Set((trades ?? []).map((tr) => tr.instrumentId))], [trades]);
  const pricesQuery = useLatestPrices(instrumentIds);

  const result = useMemo(() => {
    if (!trades || !pricesQuery.data || !instruments) return null;
    const instrumentById = new Map(instruments.map((i) => [i.id, i]));
    const positions = computePositions(trades.map((tr) => ({ id: tr.id, instrumentId: tr.instrumentId, kind: tr.kind, quantity: tr.quantity, netAmount: tr.netAmount, executedAt: tr.executedAt })));
    let currentValue = 0n;
    for (const [instrumentId, position] of positions) {
      const price = pricesQuery.data.get(instrumentId);
      const instrument = instrumentById.get(instrumentId);
      if (price && instrument) currentValue += fromMajorUnitsUnsafe(position.quantity * price.close, instrument.currencyCode);
    }
    return computePortfolioReturn(trades, currentValue, new Date());
  }, [trades, pricesQuery.data, instruments]);
  usePageHeader({ title: t("performancePage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  if (!household || !portfolios) return <Skeleton height={240} style={{ marginTop: 16 }} />;

  if (!portfolio) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <EmptyState message={t("performancePage.empty")} />
      </div>
    );
  }

  if (!trades || pricesQuery.isLoading || !result) return <Skeleton height={240} style={{ marginTop: 16 }} />;

  if (trades.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <EmptyState message={t("performancePage.empty")} />
      </div>
    );
  }

  const firstTradeAt = trades.reduce((min, tr) => (tr.executedAt < min ? tr.executedAt : min), trades[0]!.executedAt);
  const daysSinceFirst = Math.floor((Date.now() - new Date(firstTradeAt).getTime()) / (24 * 60 * 60 * 1000));
  const hasEnoughHistory = result.flowCount >= 2 && daysSinceFirst >= MIN_DAYS;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <NeedsFxBanner count={result.excludedCount} />
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 20 }}>
        {!hasEnoughHistory ? (
          <EmptyState message={t("performancePage.needsHistory", { days: Math.max(0, MIN_DAYS - daysSinceFirst) })} />
        ) : (
          <>
            <StatTile label={t("performancePage.xirr")} value={result.xirr !== null ? `${formatNumber(result.xirr * 100, 1)}%` : "—"} />
            <p className="t-caption" style={{ color: "var(--text-muted)" }}>{t("performancePage.xirrExplainer")}</p>
            <p className="t-body" style={{ color: "var(--text-secondary)" }}>{t("performancePage.benchmarksUnavailable")}</p>
          </>
        )}
      </div>
    </div>
  );
}
