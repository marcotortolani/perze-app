"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Amount, EmptyState, Icon, NeedsFxBanner, Skeleton, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAssetClasses, useInstruments, useLatestPrices, usePortfolioFromParam, usePortfolios, useTrades } from "@/hooks/use-investments";
import { useAssetClassLabel } from "@/hooks/use-asset-class-label";
import { useCachedLatestPrices } from "@/hooks/use-cached-latest-prices";
import { useElementSize } from "@/hooks/use-element-size";
import { computePositions } from "@/lib/analytics/positions";
import { squarify } from "@/lib/layout/treemap";
import { heatMixPercent } from "@/features/movements/calendar-scope";
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

/** Bloque angosto o bajo: el rectángulo del treemap no entra ni el nombre de la clase de activo ni el monto completo — se cae a solo símbolo + %. */
const COMPACT_WIDTH = 88;
const COMPACT_HEIGHT = 64;
/** Separación visual entre bloques — se resta del rect del treemap, no se suma al contenedor (el área total sigue siendo la real del dispositivo). */
const BLOCK_GAP = 6;

/**
 * I9 — asignación por POSICIÓN (no clase de activo, D55): treemap
 * cuadrado (`src/lib/layout/treemap.ts`) sobre el área real disponible en
 * pantalla — a diferencia del bento grid anterior (formas de columna
 * ELEGIDAS de una lista fija, que apilaba filas y necesitaba scroll), acá
 * el ÁREA de cada bloque es literalmente su porcentaje del total, dentro
 * de un rectángulo de tamaño fijo (el espacio que queda debajo del
 * header) que nunca desborda. Cada instrumento es su propio bloque aunque
 * comparta símbolo con otro de distinto tipo (una acción y su CEDEAR son
 * `instrumentId` distintos, `computePositions` ya los separa).
 *
 * Reemplaza el `SplitBar` anterior, que sumaba `quantity * price.close`
 * crudo entre posiciones de MONEDAS DISTINTAS sin convertir a la moneda
 * base (V9) — un CEDEAR en pesos y una acción en dólares no se pueden
 * sumar así. Mismo patrón `toBase`/`needs_fx` que `OverviewContent`.
 */
export default function AllocationPage() {
  const t = useTranslations();
  const assetClassLabel = useAssetClassLabel();
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
  const { ref: treemapRef, width: treemapWidth, height: treemapHeight } = useElementSize<HTMLDivElement>();
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
          const resolution = await fxRepo.resolve({ householdId: household!.id, base: currency, quote: household!.baseCurrency, date: todayIso(), liveRecalc: true });
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
  const positions = computePositions(trades.map((tr) => ({ id: tr.id, instrumentId: tr.instrumentId, kind: tr.kind, quantity: tr.quantity, price: tr.price, netAmount: tr.netAmount, executedAt: tr.executedAt })));

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
      assetClassName: assetClassLabel(assetClass) ?? t("investmentsPage.otherAssetClass"),
      baseValue,
      weightPct: totalValue > 0n ? (Number(baseValue) / Number(totalValue)) * 100 : 0,
    };
  });

  if (blocks.length === 0) return <EmptyState message={t("investmentsPage.noPositions")} />;

  const nodes = squarify(blocks, (b) => Number(b.baseValue), treemapWidth, treemapHeight);
  const featuredId = nodes[0]?.item.instrumentId;
  // Mismo rango secuencial que el heatmap del calendario de Transactions
  // (`heatMixPercent` + `color-mix(in srgb, var(--data-1) X%, var(--surface-1))`,
  // `TransactionsMonthCalendar.tsx`) — acá el "total del mes" de ese
  // heatmap es el peso del bloque más grande del portfolio, así que la
  // posición más pesada siempre toca el techo de intensidad.
  const maxBaseValue = Math.max(...blocks.map((b) => Number(b.baseValue)));

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

      {/* Treemap cuadrado (D73) sobre el ÁREA REAL del contenedor —
          `flex:1, minHeight:0` lo acota al espacio que sobra debajo del
          header, sin invitar scroll, y `useElementSize` mide ese espacio
          en píxeles para que `squarify` calcule el layout óptimo contra
          el tamaño de verdad del dispositivo, no un porcentaje fijo. */}
      <div ref={treemapRef} style={{ position: "relative", flex: 1, minHeight: 0, marginTop: 16 }}>
        {nodes.map(({ item: block, rect }) => {
          const featured = block.instrumentId === featuredId;
          const compact = rect.width < COMPACT_WIDTH || rect.height < COMPACT_HEIGHT;
          const w = Math.max(0, rect.width - BLOCK_GAP);
          const h = Math.max(0, rect.height - BLOCK_GAP);
          const mixPercent = heatMixPercent(block.baseValue, maxBaseValue);
          return (
            <button
              key={block.instrumentId}
              type="button"
              // master-detail — search param, no ruta propia (ver `[portfolioId]/page.tsx`).
              onClick={() => router.push(`/investments/${portfolio.id}?position=${block.instrumentId}`)}
              style={{
                position: "absolute",
                left: rect.x + BLOCK_GAP / 2,
                top: rect.y + BLOCK_GAP / 2,
                width: w,
                height: h,
                textAlign: "left",
                cursor: "pointer",
                overflow: "hidden",
                background: mixPercent > 0 ? `color-mix(in srgb, var(--data-1) ${Math.round(mixPercent)}%, var(--surface-1))` : "var(--surface-1)",
                borderRadius: "var(--radius-card)",
                padding: compact ? 8 : 16,
                border: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: compact ? "center" : "flex-start",
              }}
            >
              {/* Mismo techo de intensidad (70%) que el heatmap del
                  calendario — ahí ya se probó que `--text-primary` se lee
                  bien contra el `--data-1` más saturado, así que las tres
                  líneas del bloque usan ese mismo token en vez de
                  secundario/muted (que perdían contraste a intensidad
                  alta). La jerarquía entre líneas queda en tamaño/peso, no
                  en gris. */}
              {!compact ? (
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {block.assetClassName}
                </div>
              ) : null}
              {!compact ? (
                <div style={{ marginTop: 10 }}>
                  <Amount value={money(block.baseValue, household.baseCurrency)} size={featured ? "title" : "body"} showSign={false} polarity="neutral" fit fitFloor={0.6} />
                </div>
              ) : null}
              <div
                style={{
                  marginTop: compact ? 0 : 6,
                  fontSize: compact ? 11 : 12,
                  fontWeight: compact ? 600 : 400,
                  color: "var(--text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {compact ? block.symbol : `${block.symbol} · ${formatNumber(block.weightPct, 1)}%`}
              </div>
              {compact ? (
                <div style={{ fontSize: 10, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {formatNumber(block.weightPct, 1)}%
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Leyenda — mismo motivo que la del calendario: un heatmap sin
          escala no se puede leer, el color codifica el peso dentro del
          portfolio y no hay forma de saber qué significa un tono
          intermedio sin esto. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 12, flexShrink: 0 }}>
        <span className="t-caption" style={{ color: "var(--text-muted)" }}>
          {t("allocationPage.intensityLess")}
        </span>
        <div aria-hidden="true" style={{ width: 64, height: 8, borderRadius: 4, background: "linear-gradient(90deg, var(--surface-1), var(--data-1))" }} />
        <span className="t-caption" style={{ color: "var(--text-muted)" }}>
          {t("allocationPage.intensityMore")}
        </span>
      </div>
    </div>
  );
}
