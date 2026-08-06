"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Amount, Button, EmptyState, IconButton, Input, ListRow, SegmentedControl, Sheet, Skeleton, usePageHeader } from "@/design-system";
import { LineChart } from "@/design-system/charts";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import {
  useAssetClasses,
  useInstruments,
  useInvalidateInstruments,
  useInvalidateLatestPrices,
  useLatestPrices,
  usePortfolios,
  usePriceHistory,
  useTrades,
} from "@/hooks/use-investments";
import { computePositions } from "@/lib/analytics/positions";
import { instrumentsRepo } from "@/lib/repos/instruments-repo";
import { priceSnapshotsRepo } from "@/lib/repos/price-snapshots-repo";
import { formatAmountCompact, formatNumber } from "@/lib/money/format";
import { decimalsForQuantity } from "@/lib/money/decimals";
import { money } from "@/lib/money/money";
import { fxRepo } from "@/lib/repos/fx-repo";
import { convert } from "@/lib/fx/rate";
import { todayIso } from "@/lib/repos/ids";
import { MIN_HISTORY_POINTS, PRICE_HISTORY_RANGES, sinceIsoForRange, type PriceHistoryRange } from "@/lib/prices/history-range";
import { formatDateShort, type Locale } from "@/i18n/formatting";
import { useCachedLatestPrices } from "@/hooks/use-cached-latest-prices";

export interface InstrumentDetailContentProps {
  portfolioId: string;
  instrumentId: string;
}

/**
 * I4 — detalle de instrumento: tu posición, P&L no realizado, peso en el
 * portfolio, y el historial de operaciones. Antes esta ruta no existía —
 * `OverviewContent` ya navegaba acá (`positions/${instrument.id}`), era
 * un link roto en producción.
 */
export default function InstrumentDetailContent({ portfolioId, instrumentId }: InstrumentDetailContentProps) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: portfolios } = usePortfolios(household?.id);
  const { data: assetClasses } = useAssetClasses();
  const { data: instruments } = useInstruments(household?.id);
  const { data: trades } = useTrades(portfolioId);
  const instrumentIds = useMemo(() => [...new Set((trades ?? []).map((tr) => tr.instrumentId))], [trades]);
  const pricesQuery = useLatestPrices(instrumentIds);
  // D36 — mismo cache persistido que el overview: último precio conocido
  // mientras la consulta real todavía no resolvió, nunca "$ 0,00".
  const prices = useCachedLatestPrices(pricesQuery.data);
  const invalidatePrices = useInvalidateLatestPrices(instrumentIds);
  const invalidateInstruments = useInvalidateInstruments(household?.id);

  const [editingPrice, setEditingPrice] = useState(false);
  const [manualPrice, setManualPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [historyRange, setHistoryRange] = useState<PriceHistoryRange>("month");
  const [viewCurrency, setViewCurrency] = useState<"original" | "base">("original");

  const portfolio = portfolios?.find((p) => p.id === portfolioId);
  const instrument = instruments?.find((i) => i.id === instrumentId);
  // Se computa antes de `usePageHeader` (no después del `if` de abajo) solo
  // porque el botón de "eliminar de seguimiento" del header lo necesita, y
  // todo hook tiene que correr antes de cualquier return condicional.
  const positions = computePositions((trades ?? []).map((tr) => ({ instrumentId: tr.instrumentId, kind: tr.kind, quantity: tr.quantity, netAmount: tr.netAmount })));
  const position = positions.get(instrumentId);
  // Mismo criterio que la hoja de edición de "Instrumentos": solo un
  // instrumento propio del household (no del catálogo global) y sin
  // posición se puede sacar de seguimiento.
  const canRemoveFromWatchlist = !!household && !!instrument && instrument.householdId === household.id && (!position || position.quantity === 0);
  const sinceIso = sinceIsoForRange(historyRange, todayIso());
  const historyQuery = usePriceHistory(instrumentId, sinceIso);

  // I4/D39 — mismo toggle "moneda original / moneda base" que `OverviewContent`,
  // acá acotado a un solo instrumento en vez de a todas las monedas en
  // cartera. Un CEDEAR cotiza en pesos argentinos aunque el household lleve
  // su base en dólares — este es el toggle que deja ver ambas lecturas.
  const needsFxToggle = !!household && !!instrument && instrument.currencyCode !== household.baseCurrency;
  const fxRateQuery = useQuery({
    queryKey: ["instrument-fx-rate", household?.id, instrument?.currencyCode, household?.baseCurrency],
    queryFn: () => fxRepo.resolve({ householdId: household!.id, base: instrument!.currencyCode, quote: household!.baseCurrency, date: todayIso() }),
    enabled: needsFxToggle,
  });
  const toBase = (v: bigint): bigint | null => {
    const rate = fxRateQuery.data?.rate;
    if (!rate || !instrument) return null;
    return convert(money(v, instrument.currencyCode), household!.baseCurrency, rate).amount;
  };

  const handleRemoveFromWatchlist = async () => {
    if (!instrument || removing) return;
    setRemoving(true);
    try {
      await instrumentsRepo.deleteUnused(instrument.id);
      invalidateInstruments();
      toast(t("instrumentDetailPage.removedFromWatchlist", { symbol: instrument.symbol }));
      router.back();
    } finally {
      setRemoving(false);
    }
  };

  usePageHeader({
    title: instrument?.symbol ?? t("nav.investments"),
    onBack: () => router.back(),
    backLabel: t("ds.appHeader.back"),
    right: canRemoveFromWatchlist ? (
      <IconButton icon="bookmark" ariaLabel={t("instrumentDetailPage.removeFromWatchlist")} onClick={handleRemoveFromWatchlist} disabled={removing} />
    ) : undefined,
  });

  // `pricesQuery.isLoading` deliberadamente no bloquea (D36, ver `OverviewContent`).
  if (!household || !portfolios || !assetClasses || !instruments || !trades) {
    return <Skeleton height={280} style={{ marginTop: 16 }} />;
  }
  if (!portfolio || !instrument) {
    return <EmptyState message={t("instrumentDetailPage.notFound")} />;
  }

  const assetClass = instrument.assetClassId ? assetClasses.find((a) => a.id === instrument.assetClassId) : undefined;
  const price = prices.get(instrumentId);

  // Peso en el portfolio: mismo cálculo de valor total que `OverviewContent`, sobre TODAS las posiciones, no solo esta.
  let portfolioTotalValue = 0n;
  for (const [id, pos] of positions) {
    const p = prices.get(id);
    if (p) portfolioTotalValue += BigInt(Math.round(pos.quantity * p.close));
  }

  const value = position && price ? BigInt(Math.round(position.quantity * price.close)) : 0n;
  const unrealizedPnl = position ? value - position.costBasis : 0n;
  const avgPrice = position && position.quantity > 0 ? Number(position.costBasis) / position.quantity : null;
  const weightPct = portfolioTotalValue > 0n ? (Number(value) / Number(portfolioTotalValue)) * 100 : 0;

  // D39 — mismos montos, en la moneda elegida por el toggle. `null` =
  // pendiente de cotización (needs_fx), nunca un valor inventado.
  const displayCurrency = viewCurrency === "base" ? household.baseCurrency : instrument.currencyCode;
  const toDisplay = (v: bigint): bigint | null => (viewCurrency === "base" ? toBase(v) : v);
  const displayValue = toDisplay(value);
  const displayUnrealizedPnl = toDisplay(unrealizedPnl);
  const displayAvgPrice = avgPrice !== null ? toDisplay(BigInt(Math.round(avgPrice))) : null;
  const displayCurrentPrice = price ? toDisplay(BigInt(Math.round(price.close))) : null;

  const instrumentTrades = trades.filter((tr) => tr.instrumentId === instrumentId).sort((a, b) => (a.executedAt < b.executedAt ? 1 : -1));

  // Variación día a día: los dos cierres más recientes, no el rango
  // seleccionado — con un cierre por día (D34, cron `daily-price-sync`) no
  // hay granularidad intradía real, así que "hoy" se resuelve así en vez
  // de fingir un gráfico de un solo tramo.
  const history = historyQuery.data ?? [];
  const dayChangePct = (() => {
    if (history.length < 2) return null;
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    if (!last || !prev || prev.close === 0) return null;
    return ((last.close - prev.close) / prev.close) * 100;
  })();
  const chartPoints = history.map((h) => ({ label: formatDateShort(locale, new Date(`${h.asOf}T12:00:00Z`)), value: h.close }));
  const hasEnoughHistory = history.length >= MIN_HISTORY_POINTS;

  const handleSaveManual = async () => {
    if (!manualPrice.trim() || saving) return;
    setSaving(true);
    try {
      await priceSnapshotsRepo.setManual(instrumentId, Number(manualPrice.replace(",", ".")), instrument.currencyCode);
      invalidatePrices();
      setEditingPrice(false);
      setManualPrice("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingTop: 8, paddingBottom: 24 }}>
      <div style={{ textAlign: "center" }}>
        <div className="t-caption" style={{ color: "var(--text-muted)" }}>{assetClass?.name ?? t("investmentsPage.otherAssetClass")}</div>
        <div className="t-hero" style={{ margin: "8px 0 0" }}>
          {displayValue !== null ? (
            <Amount value={money(displayValue, displayCurrency)} size="hero" showSign={false} polarity="neutral" tabular />
          ) : (
            <span className="t-caption" style={{ color: "var(--text-muted)" }}>{t("investmentsPage.pendingFx")}</span>
          )}
        </div>
        <div style={{ marginTop: 4 }}>
          {displayUnrealizedPnl !== null ? (
            <Amount value={money(displayUnrealizedPnl, displayCurrency)} size="body" showSign polarity="neutral" tabular />
          ) : (
            <span className="t-caption" style={{ color: "var(--text-muted)" }}>{t("investmentsPage.pendingFx")}</span>
          )}
          <span className="t-label" style={{ color: "var(--text-secondary)", marginLeft: 6 }}>{t("instrumentDetailPage.unrealized")}</span>
        </div>
        {/* D39 — el toggle solo tiene sentido si el instrumento cotiza en
            una moneda distinta de la base del household (un CEDEAR en
            pesos con base en dólares); si coinciden, mostrarlo sería puro
            ruido — mismo criterio que `OverviewContent`. */}
        {needsFxToggle ? (
          <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
            <SegmentedControl
              size="sm"
              options={[
                { id: "original", label: t("investmentsPage.viewOriginalCurrency") },
                { id: "base", label: t("investmentsPage.viewBaseCurrency", { currency: household.baseCurrency }) },
              ]}
              value={viewCurrency}
              onChange={(v) => setViewCurrency(v as "original" | "base")}
            />
          </div>
        ) : null}
        {/* D34 — sin badge de frescura acá: el precio real de mercado se
            pide una sola vez al entrar al portfolio (`OverviewContent`),
            no por instrumento. Lo único que sigue haciendo falta acá es
            la carga a mano para lo que ningún proveedor cubre (FCI, plazo
            fijo, inmuebles) — nunca un "actualizar" que reimplique volver
            a pedir el mercado. */}
        {!instrument.priceProvider ? (
          <button
            type="button"
            onClick={() => setEditingPrice(true)}
            style={{ marginTop: 12, background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--text-secondary)", fontFamily: "var(--font-sans)", fontSize: 13 }}
          >
            {t("instrumentDetailPage.setPriceManually")}
          </button>
        ) : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 14 }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("instrumentDetailPage.quantity")}</div>
          <div className="t-title" style={{ marginTop: 4 }}>
            {formatNumber(
              position?.quantity ?? 0,
              decimalsForQuantity({ symbol: instrument.symbol, ...(assetClass?.name ? { assetClass: assetClass.name } : {}), ...(instrument.quantityDecimals !== null ? { decimals: instrument.quantityDecimals } : {}) })
            )}
          </div>
        </div>
        <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 14 }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("instrumentDetailPage.avgPrice")}</div>
          <div className="t-title" style={{ marginTop: 4 }}>
            {displayAvgPrice !== null ? formatAmountCompact(money(displayAvgPrice, displayCurrency), { showSign: false }) : avgPrice !== null ? t("investmentsPage.pendingFx") : "—"}
          </div>
        </div>
        <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 14 }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("instrumentDetailPage.currentPrice")}</div>
          <div className="t-title" style={{ marginTop: 4 }}>
            {displayCurrentPrice !== null ? formatAmountCompact(money(displayCurrentPrice, displayCurrency), { showSign: false }) : price ? t("investmentsPage.pendingFx") : "—"}
          </div>
          {dayChangePct !== null ? (
            <div className="t-caption" style={{ marginTop: 2, color: "var(--text-secondary)" }}>
              {dayChangePct >= 0 ? "↑" : "↓"} {Math.abs(dayChangePct).toFixed(1)}% {t("instrumentDetailPage.today")}
            </div>
          ) : null}
        </div>
        <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 14 }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("instrumentDetailPage.weight")}</div>
          <div className="t-title" style={{ marginTop: 4 }}>{weightPct.toFixed(1)}%</div>
        </div>
      </div>

      {/* I4 — fluctuación histórica: un cierre por día (cron `daily-price-sync`),
          así que el rango no baja de "semana" — un gráfico de dos puntos
          enseña una tendencia que no existe (mismo criterio que los mínimos
          de historial de CLAUDE.md). Con menos de `MIN_HISTORY_POINTS`
          cierres reales para el rango elegido, se muestra cuánto falta en
          vez del gráfico. */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("instrumentDetailPage.fluctuation")}</div>
          <SegmentedControl
            size="sm"
            options={PRICE_HISTORY_RANGES.map((r) => ({ id: r, label: t(`instrumentDetailPage.range.${r}`) }))}
            value={historyRange}
            onChange={(r) => setHistoryRange(r as PriceHistoryRange)}
          />
        </div>
        {hasEnoughHistory ? (
          <LineChart
            data={chartPoints}
            formatValue={(v) => formatAmountCompact(money(BigInt(Math.round(v)), instrument.currencyCode), { showSign: false })}
            ariaLabel={t("instrumentDetailPage.fluctuation")}
          />
        ) : (
          <EmptyState message={t("instrumentDetailPage.notEnoughHistory", { count: MIN_HISTORY_POINTS - history.length })} />
        )}
      </div>

      <Button variant="secondary" onClick={() => router.push(`/investments/${portfolioId}/trades/new?instrumentId=${instrument.id}`)}>
        {t("instrumentDetailPage.recordTrade")}
      </Button>

      <div>
        <div className="t-caption" style={{ color: "var(--text-muted)", marginBottom: 8 }}>{t("instrumentDetailPage.history")}</div>
        {instrumentTrades.length === 0 ? (
          <EmptyState message={t("instrumentDetailPage.noHistory")} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {instrumentTrades.map((tr) => (
              <ListRow
                key={tr.id}
                icon={tr.kind === "buy" ? "plus" : "minus"}
                label={tr.kind === "buy" ? t("newTradePage.buy") : tr.kind === "sell" ? t("newTradePage.sell") : tr.kind}
                meta={`${formatDateShort(locale, new Date(tr.executedAt))} · ${formatNumber(tr.quantity, decimalsForQuantity({ symbol: instrument.symbol, ...(assetClass?.name ? { assetClass: assetClass.name } : {}) }))} × ${formatAmountCompact(money(BigInt(Math.round(tr.price)), tr.currencyCode), { showSign: false })}`}
                variant="value"
                value={<Amount value={money(tr.netAmount, tr.currencyCode)} size="body" showSign={false} polarity="neutral" tabular />}
              />
            ))}
          </div>
        )}
      </div>

      <Sheet open={editingPrice} title={t("instrumentsListPage.updatePrice", { symbol: instrument.symbol })} onClose={() => setEditingPrice(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label={t("instrumentsListPage.price", { currency: instrument.currencyCode })} value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} autoFocus />
          <Button disabled={!manualPrice.trim() || saving} onClick={handleSaveManual}>
            {t("common.save")}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
