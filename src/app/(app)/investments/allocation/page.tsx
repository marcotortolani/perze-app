"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Amount, EmptyState, Icon, NeedsFxBanner, Skeleton, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAssetClasses, useInstruments, useLatestPrices, usePortfolioFromParam, usePortfolios, useTrades } from "@/hooks/use-investments";
import { useCachedLatestPrices } from "@/hooks/use-cached-latest-prices";
import { computePositions } from "@/lib/analytics/positions";
import { assignBentoSlots } from "@/lib/layout/bento";
import { fxRepo } from "@/lib/repos/fx-repo";
import { convert } from "@/lib/fx/rate";
import { todayIso } from "@/lib/repos/ids";
import type { FxResolution } from "@/lib/fx/resolve";
import { fromMajorUnitsUnsafe, money } from "@/lib/money/money";
import { formatNumber } from "@/lib/money/format";

interface AllocationBlock {
  instrumentId: string;
  symbol: string;
  assetClassName: string;
  baseValue: bigint;
  weightPct: number;
}

/**
 * I9 — asignación por POSICIÓN (no clase de activo, D55): bento grid de
 * 12 columnas, mismo motor que el carrusel de cuentas del home
 * (`src/lib/layout/bento.ts`) — el bloque más pesado ocupa el slot más
 * ancho, sin deformar la grilla en tabla. Cada instrumento es su propio
 * bloque aunque comparta símbolo con otro de distinto tipo (una acción y
 * su CEDEAR son `instrumentId` distintos, `computePositions` ya los
 * separa — no hace falta mergear nada acá).
 *
 * Reemplaza el `SplitBar` anterior, que sumaba `quantity * price.close`
 * crudo entre posiciones de MONEDAS DISTINTAS sin convertir a la moneda
 * base (V9) — un CEDEAR en pesos y una acción en dólares no se pueden
 * sumar así. Mismo patrón `toBase`/`needs_fx` que `OverviewContent`.
 */
export default function AllocationPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: portfolios } = usePortfolios(household?.id);
  const portfolio = usePortfolioFromParam(portfolios);
  const { data: trades } = useTrades(portfolio?.id);
  const { data: assetClasses } = useAssetClasses();
  const { data: instruments } = useInstruments(household?.id);
  const instrumentIds = useMemo(() => [...new Set((trades ?? []).map((tr) => tr.instrumentId))], [trades]);
  const pricesQuery = useLatestPrices(instrumentIds);
  // D36 — mismo cache persistido que el overview/detalle: último precio
  // conocido mientras la consulta real todavía no resolvió.
  const prices = useCachedLatestPrices(pricesQuery.data);
  usePageHeader({ title: t("allocationPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  const instrumentById = useMemo(() => new Map((instruments ?? []).map((i) => [i.id, i])), [instruments]);
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

  if (!household || !portfolios || !assetClasses || !instruments) return <Skeleton height={200} style={{ marginTop: 16 }} />;
  if (!portfolio || !trades) return <Skeleton height={200} style={{ marginTop: 16 }} />;

  const assetClassById = new Map(assetClasses.map((a) => [a.id, a]));
  const positions = computePositions(trades.map((tr) => ({ instrumentId: tr.instrumentId, kind: tr.kind, quantity: tr.quantity, netAmount: tr.netAmount })));

  const toBase = (value: bigint, currencyCode: string): bigint | null => {
    if (currencyCode === household.baseCurrency) return value;
    const resolution = fxRatesQuery.data?.get(currencyCode);
    if (!resolution?.rate) return null;
    return convert(money(value, currencyCode), household.baseCurrency, resolution.rate).amount;
  };

  let totalValue = 0n;
  let excludedFxCount = 0;
  let excludedNoPriceCount = 0;
  const items: { instrumentId: string; baseValue: bigint }[] = [];
  for (const [instrumentId, position] of positions) {
    if (position.quantity <= 0) continue;
    const instrument = instrumentById.get(instrumentId);
    const price = prices.get(instrumentId);
    if (!instrument) continue;
    if (!price) {
      excludedNoPriceCount += 1;
      continue;
    }
    const value = fromMajorUnitsUnsafe(position.quantity * price.close, instrument.currencyCode);
    const baseValue = toBase(value, instrument.currencyCode);
    if (baseValue === null) {
      excludedFxCount += 1;
      continue;
    }
    totalValue += baseValue;
    items.push({ instrumentId, baseValue });
  }

  const blocks: AllocationBlock[] = items.map(({ instrumentId, baseValue }) => {
    const instrument = instrumentById.get(instrumentId)!;
    const assetClass = instrument.assetClassId ? assetClassById.get(instrument.assetClassId) : undefined;
    return {
      instrumentId,
      symbol: instrument.symbol,
      assetClassName: assetClass?.name ?? t("investmentsPage.otherAssetClass"),
      baseValue,
      weightPct: totalValue > 0n ? (Number(baseValue) / Number(totalValue)) * 100 : 0,
    };
  });

  if (blocks.length === 0) return <EmptyState message={t("investmentsPage.noPositions")} />;

  const { gridItems, gridSpans } = assignBentoSlots(blocks, (b) => Number(b.baseValue));
  const featuredId = gridItems[0]?.instrumentId;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <NeedsFxBanner count={excludedFxCount} onResolve={() => router.push("/accounts/resolve-fx")} style={{ marginTop: 16 }} />
      {/* D60 — mismo peso visual que `NeedsFxBanner` pero copy propio: causa
          distinta (precio de mercado ausente, no FX pendiente). */}
      {excludedNoPriceCount > 0 ? (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px var(--screen-padding)",
            background: "color-mix(in srgb, var(--warning) 12%, transparent)",
            borderRadius: "var(--radius-card)",
            marginTop: 8,
            fontSize: 13,
            color: "var(--text-secondary)",
          }}
        >
          <Icon name="alert" size={15} strokeWidth={2} color="var(--warning)" />
          <span>{t("investmentsPage.excludedNoPrice", { count: excludedNoPriceCount })}</span>
        </div>
      ) : null}

      <div className="bento-grid" style={{ marginTop: 16 }}>
        {gridItems.map((block, i) => {
          const featured = block.instrumentId === featuredId;
          return (
            <button
              key={block.instrumentId}
              type="button"
              // master-detail — search param, no ruta propia (ver `[portfolioId]/page.tsx`).
              onClick={() => router.push(`/investments/${portfolio.id}?position=${block.instrumentId}`)}
              style={{
                gridColumn: `span ${gridSpans[i]}`,
                textAlign: "left",
                cursor: "pointer",
                background: "var(--surface-1)",
                borderRadius: "var(--radius-card)",
                padding: 16,
                border: 0,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {block.assetClassName}
              </div>
              <div style={{ marginTop: 10 }}>
                <Amount value={money(block.baseValue, household.baseCurrency)} size={featured ? "title" : "body"} showSign={false} polarity="neutral" fit fitFloor={0.7} />
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {block.symbol} · {formatNumber(block.weightPct, 1)}%
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
