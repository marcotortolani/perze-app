"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Amount, EmptyState, ListRow, NeedsFxBanner, PositionRow, SegmentedControl, Skeleton, usePageHeader } from "@/design-system";
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
import { priceSnapshotsRepo, type LatestPrice } from "@/lib/repos/price-snapshots-repo";
import { useDateFormatPreference } from "@/stores/format-preferences-store";
import { formatNumericDate, formatTimeOfDay, type Locale } from "@/i18n/formatting";
import { useCachedLatestPrices } from "@/hooks/use-cached-latest-prices";

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
  const locale = useLocale() as Locale;
  const dateFormat = useDateFormatPreference();
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
  // D36 — el último valor de mercado conocido (localStorage) rellena el
  // hueco mientras `pricesQuery` todavía no resolvió o la API falló, para
  // no mostrar nunca "$ 0,00" por una demora o un corte de red — ver el
  // comentario del store.
  const prices = useCachedLatestPrices(pricesQuery.data);
  const queryClient = useQueryClient();
  const [viewCurrency, setViewCurrency] = useState<"original" | "base">("original");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const instrumentById = useMemo(() => new Map((instruments ?? []).map((i) => [i.id, i])), [instruments]);
  const providerInstrumentIds = useMemo(() => instrumentIds.filter((id) => instrumentById.get(id)?.priceProvider), [instrumentIds, instrumentById]);
  // Escribe directo en el cache de `useLatestPrices` (misma query key que
  // usa `InstrumentDetailContent` para este mismo portfolio) en vez de
  // guardar el resultado en un state local — así el detalle de un
  // instrumento ve el precio recién pedido sin tener que volver a
  // pedirlo él mismo (D34: el refresh en vivo vive acá, no en I4).
  const refreshPrices = useCallback(async () => {
    if (providerInstrumentIds.length === 0) return;
    const results = await Promise.all(providerInstrumentIds.map((id) => priceSnapshotsRepo.refreshFromProvider(id).then((quote) => [id, quote] as const)));
    queryClient.setQueryData<Map<string, LatestPrice>>(["latest-prices", [...instrumentIds].sort()], (old) => {
      const merged = new Map(old ?? []);
      for (const [id, quote] of results) if (quote) merged.set(id, quote);
      return merged;
    });
    setLastRefreshedAt(new Date());
  }, [providerInstrumentIds, instrumentIds, queryClient]);

  // D34 — antes cada posición mostraba su propio badge "Actualizado"/
  // "Manual" (`PriceStatus`), que además nunca reflejaba un precio en
  // vivo (solo el cache de `price_snapshots`, que escribe el cron diario).
  // Ahora se pide la cotización real de mercado de todo lo que está en
  // cartera una sola vez al entrar al portfolio, y la pantalla declara UN
  // solo "última actualización" en vez de un badge por fila.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch en vivo genuino al entrar al portfolio, no derivable del render
    refreshPrices().catch(() => {
      if (!cancelled) return; // sin red: la pantalla sigue mostrando el cache.
    });
    return () => {
      cancelled = true;
    };
  }, [refreshPrices]);

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

  // `pricesQuery.isLoading` deliberadamente NO bloquea el render acá — con
  // el cache persistido (D36), la pantalla ya tiene algo real para
  // mostrar aunque la consulta todavía esté en vuelo.
  if (!trades) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  const assetClassById = new Map(assetClasses.map((a) => [a.id, a]));
  const positions = computePositions(trades.map((tr) => ({ instrumentId: tr.instrumentId, kind: tr.kind, quantity: tr.quantity, netAmount: tr.netAmount })));

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, gap: 12 }}>
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
        {/* Un solo indicador de frescura por PANTALLA, no uno por fila
            (D34) — declara cuándo se pidió el precio real por última vez
            en vez de que cada posición lleve su propio "Actualizado"/
            "Manual", que además nunca reflejaba el mercado en vivo. */}
        {lastRefreshedAt ? (
          <div className="t-caption" style={{ color: "var(--text-muted)", marginBottom: 12 }}>
            {t("investmentsPage.lastRefreshed", { date: formatNumericDate(locale, lastRefreshedAt, dateFormat), time: formatTimeOfDay(locale, lastRefreshedAt) })}
          </div>
        ) : null}
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
                onClick={() => router.push(`/investments/${portfolio.id}/positions/${instrument.id}`)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
