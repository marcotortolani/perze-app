"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Amount, EmptyState, ListRow, NeedsFxBanner, PositionRow, PriceStatus, SegmentedControl, Skeleton, usePageHeader } from "@/design-system";
import { Donut } from "@/design-system/charts";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useAssetClasses, useInstruments, useLatestPrices, usePortfolios, useTrades } from "@/hooks/use-investments";
import { computePositions } from "@/lib/analytics/positions";
import { formatAmountCompact, formatNumber } from "@/lib/money/format";
import { decimalsForQuantity } from "@/lib/money/decimals";
import { money } from "@/lib/money/money";
import { fxRepo } from "@/lib/repos/fx-repo";
import { convert } from "@/lib/fx/rate";
import { todayIso } from "@/lib/repos/ids";
import type { FxResolution } from "@/lib/fx/resolve";

export interface OverviewContentProps {
  portfolioId: string;
}

/**
 * I2/I3 — overview de UN portfolio: composición por clase de activo
 * (Donut) + valor total + posiciones. Antes esto vivía en `/investments`
 * a secas y asumía "el primer portfolio del household"
 * (`portfolios?.[0]`) — ahora `portfolioId` viene de la URL
 * (`/investments/[portfolioId]`, la ruta que ya elige `PortfoliosListContent`),
 * así que un household con más de un portfolio los distingue de verdad.
 */
export default function OverviewContent({ portfolioId }: OverviewContentProps) {
  const t = useTranslations();
  const router = useRouter();
  const userId = useEffectiveUserId();
  const { data: household } = useCurrentHousehold();
  const { data: portfolios } = usePortfolios(household?.id);
  const { data: assetClasses } = useAssetClasses();
  const { data: instruments } = useInstruments(household?.id);

  const portfolio = portfolios?.find((p) => p.id === portfolioId);
  usePageHeader({ title: portfolio?.name ?? t("nav.investments"), onBack: () => router.push("/investments"), backLabel: t("ds.appHeader.back") });
  const { data: trades } = useTrades(portfolio?.id);
  const instrumentIds = useMemo(() => [...new Set((trades ?? []).map((tr) => tr.instrumentId))], [trades]);
  const pricesQuery = useLatestPrices(instrumentIds);
  const [viewCurrency, setViewCurrency] = useState<"original" | "base">("original");

  const instrumentById = useMemo(() => new Map((instruments ?? []).map((i) => [i.id, i])), [instruments]);
  // Monedas de instrumentos EN CARTERA (no todo el catálogo) distintas de
  // la base — la Fase de tokens de CLAUDE.md prohíbe sumar bigints de
  // monedas distintas (`totalValue` antes sumaba el `value` crudo de cada
  // posición sin convertir, dando un número sin sentido apenas hubiera una
  // posición en una moneda != base, como un CEDEAR en ARS con base UYU).
  const heldCurrencies = useMemo(
    () => [...new Set(instrumentIds.map((id) => instrumentById.get(id)?.currencyCode).filter((c): c is string => !!c && c !== household?.baseCurrency))],
    [instrumentIds, instrumentById, household?.baseCurrency]
  );
  const fxRatesQuery = useQuery({
    queryKey: ["portfolio-fx-rates", household?.id, household?.baseCurrency, heldCurrencies],
    queryFn: async () => {
      const entries = await Promise.all(
        heldCurrencies.map(async (currency) => {
          const resolution = await fxRepo.resolve({ householdId: household!.id, base: currency, quote: household!.baseCurrency, date: todayIso() });
          return [currency, resolution] as const;
        })
      );
      return new Map<string, FxResolution>(entries);
    },
    enabled: !!household && heldCurrencies.length > 0,
  });

  if (!household || !portfolios || !assetClasses || !instruments || !userId) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  // Un `portfolioId` que no existe (más) para este household — vuelve a
  // la lista en vez de quedarse en un overview huérfano.
  if (!portfolio) {
    router.replace("/investments");
    return <Skeleton height={280} style={{ marginTop: 16 }} />;
  }

  if (!trades || pricesQuery.isLoading) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  const assetClassById = new Map(assetClasses.map((a) => [a.id, a]));
  const positions = computePositions(trades.map((tr) => ({ instrumentId: tr.instrumentId, kind: tr.kind, quantity: tr.quantity, netAmount: tr.netAmount })));
  const prices = pricesQuery.data ?? new Map();

  /**
   * `needs_fx` para posiciones: sin rate no hay forma de sumar esta
   * posición al total en moneda base (CLAUDE.md § needs_fx) — se excluye
   * del Donut/total y se cuenta, nunca se trata como si valiera 0.
   */
  const toBase = (value: bigint, currencyCode: string): bigint | null => {
    if (currencyCode === household.baseCurrency) return value;
    const resolution = fxRatesQuery.data?.get(currencyCode);
    if (!resolution?.rate) return null;
    return convert(money(value, currencyCode), household.baseCurrency, resolution.rate).amount;
  };

  let totalValue = 0n;
  let excludedCount = 0;
  const byAssetClass = new Map<string, number>();
  for (const [instrumentId, position] of positions) {
    const instrument = instrumentById.get(instrumentId);
    const price = prices.get(instrumentId);
    if (!instrument) continue;
    const value = price ? BigInt(Math.round(position.quantity * price.close)) : 0n;
    const baseValue = toBase(value, instrument.currencyCode);
    if (baseValue === null) {
      excludedCount += 1;
      continue;
    }
    totalValue += baseValue;
    const acKey = instrument.assetClassId ?? "__other";
    byAssetClass.set(acKey, (byAssetClass.get(acKey) ?? 0) + Number(baseValue));
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

      <NeedsFxBanner count={excludedCount} />

      <ListRow icon="plus" label={t("investmentsPage.recordTrade")} variant="action" onClick={() => router.push(`/investments/${portfolio.id}/trades/new`)} />
      <ListRow icon="chart" label={t("investmentsPage.newInstrument")} onClick={() => router.push(`/investments/${portfolio.id}/instruments/new`)} />
      <ListRow icon="target" label={t("allocationPage.title")} onClick={() => router.push("/investments/allocation")} />
      <ListRow icon="trend" label={t("performancePage.title")} onClick={() => router.push("/investments/performance")} />
      <ListRow icon="calendar" label={t("futureIncomePage.title")} onClick={() => router.push("/investments/future-income")} />
      <ListRow icon="clock" label={t("pricesStatusPage.title")} onClick={() => router.push("/investments/prices")} />
      <ListRow icon="tag" label={t("assetClassesPage.title")} onClick={() => router.push("/investments/asset-classes")} />

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 12 }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("investmentsPage.positions")}</div>
          {/* Solo si hay algo que convertir: con todo en la moneda base el
              toggle no cambiaría nada y sería puro ruido. */}
          {heldCurrencies.length > 0 ? (
            <SegmentedControl
              options={[
                { id: "original", label: t("investmentsPage.viewOriginalCurrency") },
                { id: "base", label: t("investmentsPage.viewBaseCurrency", { currency: household.baseCurrency }) },
              ]}
              value={viewCurrency}
              onChange={(v) => setViewCurrency(v as "original" | "base")}
            />
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {[...positions.values()].map((position) => {
            const instrument = instrumentById.get(position.instrumentId);
            if (!instrument) return null;
            const price = prices.get(position.instrumentId);
            const assetClass = instrument.assetClassId ? assetClassById.get(instrument.assetClassId) : undefined;
            const value = price ? BigInt(Math.round(position.quantity * price.close)) : 0n;
            const changePct = price && Number(position.costBasis) > 0 ? ((Number(value) - Number(position.costBasis)) / Number(position.costBasis)) * 100 : 0;
            const baseValue = viewCurrency === "base" ? toBase(value, instrument.currencyCode) : null;
            const displayValue =
              viewCurrency === "base" ? (
                baseValue !== null ? (
                  <Amount value={money(baseValue, household.baseCurrency)} size="body" showSign={false} polarity="neutral" tabular />
                ) : (
                  <span className="t-caption" style={{ color: "var(--text-muted)" }}>{t("investmentsPage.pendingFx")}</span>
                )
              ) : (
                <Amount value={money(value, instrument.currencyCode)} size="body" showSign={false} polarity="neutral" tabular />
              );
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
                value={displayValue}
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
