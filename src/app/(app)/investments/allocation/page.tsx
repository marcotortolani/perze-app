"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, Skeleton, SplitBar, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAssetClasses, useInstruments, useLatestPrices, usePortfolios, useTrades } from "@/hooks/use-investments";
import { computePositions } from "@/lib/analytics/positions";

/** I9 — asignación por clase de activo, como riel arrastrable (sin la paleta de datos — CON-11). */
export default function AllocationPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: portfolios } = usePortfolios(household?.id);
  const portfolio = portfolios?.[0];
  const { data: trades } = useTrades(portfolio?.id);
  const { data: assetClasses } = useAssetClasses();
  const { data: instruments } = useInstruments(household?.id);
  const instrumentIds = useMemo(() => [...new Set((trades ?? []).map((tr) => tr.instrumentId))], [trades]);
  const pricesQuery = useLatestPrices(instrumentIds);
  usePageHeader({ title: t("allocationPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  if (!household || !portfolios || !assetClasses || !instruments) return <Skeleton height={200} style={{ marginTop: 16 }} />;
  if (!portfolio || !trades || pricesQuery.isLoading) return <Skeleton height={200} style={{ marginTop: 16 }} />;

  const instrumentById = new Map(instruments.map((i) => [i.id, i]));
  const assetClassById = new Map(assetClasses.map((a) => [a.id, a]));
  const positions = computePositions(trades.map((tr) => ({ instrumentId: tr.instrumentId, kind: tr.kind, quantity: tr.quantity, netAmount: tr.netAmount })));
  const prices = pricesQuery.data ?? new Map();

  const byAssetClass = new Map<string, number>();
  for (const [instrumentId, position] of positions) {
    const instrument = instrumentById.get(instrumentId);
    const price = prices.get(instrumentId);
    if (!instrument || !price) continue;
    const value = position.quantity * price.close;
    const key = instrument.assetClassId ?? "__other";
    byAssetClass.set(key, (byAssetClass.get(key) ?? 0) + value);
  }

  const parts = [...byAssetClass.entries()].map(([id, value]) => ({
    label: id === "__other" ? t("investmentsPage.otherAssetClass") : (assetClassById.get(id)?.name ?? id),
    value,
  }));

  if (parts.length === 0) return <EmptyState message={t("investmentsPage.noPositions")} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: 24 }}>
        <SplitBar parts={parts} height={28} showValues />
      </div>
    </div>
  );
}
