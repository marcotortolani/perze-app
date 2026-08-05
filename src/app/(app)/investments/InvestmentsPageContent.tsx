"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Amount, EmptyState, ListRow, PositionRow, PriceStatus, Skeleton, usePageHeader } from "@/design-system";
import { Donut } from "@/design-system/charts";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useAssetClasses, useInstruments, useInvalidatePortfolios, useLatestPrices, usePortfolios, useTrades } from "@/hooks/use-investments";
import { computePositions } from "@/lib/analytics/positions";
import { formatAmountCompact, formatNumber } from "@/lib/money/format";
import { decimalsForQuantity } from "@/lib/money/decimals";
import { money } from "@/lib/money/money";
import { portfoliosRepo } from "@/lib/repos/portfolios-repo";

/**
 * I1/I2 — inversiones: activa el portfolio (F0-equivalente del módulo) y
 * muestra la composición por clase de activo (Donut) + valor total.
 * Separado de `page.tsx` — ver el comentario en `budgets/BudgetsPageContent.tsx`.
 */
export default function InvestmentsPageContent() {
  const t = useTranslations();
  usePageHeader({ title: t("nav.investments") });
  const router = useRouter();
  const userId = useEffectiveUserId();
  const { data: household } = useCurrentHousehold();
  const { data: portfolios } = usePortfolios(household?.id);
  const invalidatePortfolios = useInvalidatePortfolios(household?.id);
  const { data: assetClasses } = useAssetClasses();
  const { data: instruments } = useInstruments(household?.id);

  const portfolio = portfolios?.[0];
  const { data: trades } = useTrades(portfolio?.id);
  const instrumentIds = useMemo(() => [...new Set((trades ?? []).map((tr) => tr.instrumentId))], [trades]);
  const pricesQuery = useLatestPrices(instrumentIds);

  if (!household || !portfolios || !assetClasses || !instruments || !userId) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  if (!portfolio) {
    return (
      <EmptyState
        message={t("investmentsPage.noPortfolio")}
        actionLabel={t("investmentsPage.createPortfolio")}
        onAction={async () => {
          await portfoliosRepo.create({ householdId: household.id, name: t("investmentsPage.defaultPortfolioName"), baseCurrency: household.baseCurrency, brokerAccountId: null, createdBy: userId });
          invalidatePortfolios();
        }}
      />
    );
  }

  if (!trades || pricesQuery.isLoading) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  const instrumentById = new Map(instruments.map((i) => [i.id, i]));
  const assetClassById = new Map(assetClasses.map((a) => [a.id, a]));
  const positions = computePositions(trades.map((tr) => ({ instrumentId: tr.instrumentId, kind: tr.kind, quantity: tr.quantity, netAmount: tr.netAmount })));
  const prices = pricesQuery.data ?? new Map();

  let totalValue = 0n;
  const byAssetClass = new Map<string, number>();
  for (const [instrumentId, position] of positions) {
    const instrument = instrumentById.get(instrumentId);
    const price = prices.get(instrumentId);
    if (!instrument) continue;
    const value = price ? BigInt(Math.round(position.quantity * price.close)) : 0n;
    totalValue += value;
    const acKey = instrument.assetClassId ?? "__other";
    byAssetClass.set(acKey, (byAssetClass.get(acKey) ?? 0) + Number(value));
  }

  const slices = [...byAssetClass.entries()].map(([acId, value]) => ({
    label: acId === "__other" ? t("investmentsPage.otherAssetClass") : (assetClassById.get(acId)?.name ?? acId),
    value,
  }));

  if (positions.size === 0) {
    return <EmptyState message={t("investmentsPage.noPositions")} actionLabel={t("investmentsPage.recordTrade")} onAction={() => router.push(`/investments/${portfolio.id}/trades/new`)} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 8, paddingBottom: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <Donut slices={slices} dimension={formatAmountCompact(money(totalValue, household.baseCurrency), { showSign: false })} />
      </div>

      <ListRow icon="plus" label={t("investmentsPage.recordTrade")} variant="action" onClick={() => router.push(`/investments/${portfolio.id}/trades/new`)} />
      <ListRow icon="chart" label={t("investmentsPage.newInstrument")} onClick={() => router.push(`/investments/${portfolio.id}/instruments/new`)} />
      <ListRow icon="target" label={t("allocationPage.title")} onClick={() => router.push("/investments/allocation")} />
      <ListRow icon="trend" label={t("performancePage.title")} onClick={() => router.push("/investments/performance")} />
      <ListRow icon="calendar" label={t("futureIncomePage.title")} onClick={() => router.push("/investments/future-income")} />
      <ListRow icon="clock" label={t("pricesStatusPage.title")} onClick={() => router.push("/investments/prices")} />
      <ListRow icon="tag" label={t("assetClassesPage.title")} onClick={() => router.push("/investments/asset-classes")} />

      <div>
        <div className="t-caption" style={{ color: "var(--text-muted)", marginBottom: 8 }}>{t("investmentsPage.positions")}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {[...positions.values()].map((position) => {
            const instrument = instrumentById.get(position.instrumentId);
            if (!instrument) return null;
            const price = prices.get(position.instrumentId);
            const assetClass = instrument.assetClassId ? assetClassById.get(instrument.assetClassId) : undefined;
            const value = price ? BigInt(Math.round(position.quantity * price.close)) : 0n;
            const changePct = price && Number(position.costBasis) > 0 ? ((Number(value) - Number(position.costBasis)) / Number(position.costBasis)) * 100 : 0;
            return (
              <PositionRow
                key={position.instrumentId}
                symbol={instrument.symbol}
                assetClass={assetClass?.name ?? t("investmentsPage.otherAssetClass")}
                quantity={formatNumber(
                  position.quantity,
                  decimalsForQuantity({
                    symbol: instrument.symbol,
                    ...(assetClass?.name ? { assetClass: assetClass.name } : {}),
                    ...(instrument.quantityDecimals !== null ? { decimals: instrument.quantityDecimals } : {}),
                  })
                )}
                price={price ? formatAmountCompact(money(BigInt(Math.round(price.close)), instrument.currencyCode), { showSign: false }) : undefined}
                value={<Amount value={money(value, instrument.currencyCode)} size="body" showSign={false} polarity="neutral" tabular />}
                changePct={<span>{changePct >= 0 ? "↑" : "↓"} {Math.abs(changePct).toFixed(1)}%</span>}
                status={<PriceStatus state={price ? "fresh" : "manual"} />}
                onClick={() => router.push(`/investments/${portfolio.id}/positions/${instrument.id}`)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
