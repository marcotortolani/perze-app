"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Amount, Button, EmptyState, Input, ListRow, PriceStatus, Sheet, Skeleton, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAssetClasses, useInstruments, useInvalidateLatestPrices, useLatestPrices, usePortfolios, useTrades } from "@/hooks/use-investments";
import { computePositions } from "@/lib/analytics/positions";
import { priceSnapshotsRepo } from "@/lib/repos/price-snapshots-repo";
import { formatAmountCompact, formatNumber } from "@/lib/money/format";
import { decimalsForQuantity } from "@/lib/money/decimals";
import { money } from "@/lib/money/money";
import { formatDateShort, type Locale } from "@/i18n/formatting";

export interface InstrumentDetailContentProps {
  portfolioId: string;
  instrumentId: string;
}

const STALE_HOURS = 24;

function priceState(asOf: string | undefined, provider: string | undefined): { state: "fresh" | "stale" | "manual"; ageHours: number } {
  if (!asOf) return { state: "manual", ageHours: 0 };
  const ageHours = Math.round((Date.now() - new Date(asOf).getTime()) / (1000 * 60 * 60));
  if (provider === "manual") return { state: "manual", ageHours };
  return { state: ageHours > STALE_HOURS ? "stale" : "fresh", ageHours };
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
  const invalidatePrices = useInvalidateLatestPrices(instrumentIds);

  const [editingPrice, setEditingPrice] = useState(false);
  const [manualPrice, setManualPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const portfolio = portfolios?.find((p) => p.id === portfolioId);
  const instrument = instruments?.find((i) => i.id === instrumentId);
  usePageHeader({ title: instrument?.symbol ?? t("nav.investments"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  if (!household || !portfolios || !assetClasses || !instruments || !trades || pricesQuery.isLoading) {
    return <Skeleton height={280} style={{ marginTop: 16 }} />;
  }
  if (!portfolio || !instrument) {
    return <EmptyState message={t("instrumentDetailPage.notFound")} />;
  }

  const assetClass = instrument.assetClassId ? assetClasses.find((a) => a.id === instrument.assetClassId) : undefined;
  const price = pricesQuery.data?.get(instrumentId);
  const positions = computePositions(trades.map((tr) => ({ instrumentId: tr.instrumentId, kind: tr.kind, quantity: tr.quantity, netAmount: tr.netAmount })));
  const position = positions.get(instrumentId);

  // Peso en el portfolio: mismo cálculo de valor total que `OverviewContent`, sobre TODAS las posiciones, no solo esta.
  const prices = pricesQuery.data ?? new Map();
  let portfolioTotalValue = 0n;
  for (const [id, pos] of positions) {
    const p = prices.get(id);
    if (p) portfolioTotalValue += BigInt(Math.round(pos.quantity * p.close));
  }

  const value = position && price ? BigInt(Math.round(position.quantity * price.close)) : 0n;
  const unrealizedPnl = position ? value - position.costBasis : 0n;
  const avgPrice = position && position.quantity > 0 ? Number(position.costBasis) / position.quantity : null;
  const weightPct = portfolioTotalValue > 0n ? (Number(value) / Number(portfolioTotalValue)) * 100 : 0;

  const instrumentTrades = trades.filter((tr) => tr.instrumentId === instrumentId).sort((a, b) => (a.executedAt < b.executedAt ? 1 : -1));

  const { state, ageHours } = priceState(price?.asOf, price?.provider);

  const handleRefreshPrice = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const refreshed = await priceSnapshotsRepo.refreshFromProvider(instrumentId);
      if (refreshed) {
        toast(t("instrumentDetailPage.priceUpdated"));
        invalidatePrices();
      } else {
        setEditingPrice(true);
      }
    } finally {
      setRefreshing(false);
    }
  };

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
          <Amount value={money(value, instrument.currencyCode)} size="hero" showSign={false} polarity="neutral" tabular />
        </div>
        <div style={{ marginTop: 4 }}>
          <Amount value={money(unrealizedPnl, instrument.currencyCode)} size="body" showSign polarity="neutral" tabular />
          <span className="t-label" style={{ color: "var(--text-secondary)", marginLeft: 6 }}>{t("instrumentDetailPage.unrealized")}</span>
        </div>
        <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
          <PriceStatus state={state} ageHours={ageHours} onUpdate={handleRefreshPrice} />
        </div>
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
          <div className="t-title" style={{ marginTop: 4 }}>{avgPrice !== null ? formatAmountCompact(money(BigInt(Math.round(avgPrice)), instrument.currencyCode), { showSign: false }) : "—"}</div>
        </div>
        <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 14 }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("instrumentDetailPage.currentPrice")}</div>
          <div className="t-title" style={{ marginTop: 4 }}>{price ? formatAmountCompact(money(BigInt(Math.round(price.close)), instrument.currencyCode), { showSign: false }) : "—"}</div>
        </div>
        <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 14 }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("instrumentDetailPage.weight")}</div>
          <div className="t-title" style={{ marginTop: 4 }}>{weightPct.toFixed(1)}%</div>
        </div>
      </div>

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

      <Sheet open={editingPrice} title={t("pricesStatusPage.updatePrice", { symbol: instrument.symbol })} onClose={() => setEditingPrice(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label={t("pricesStatusPage.price", { currency: instrument.currencyCode })} value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} autoFocus />
          <Button disabled={!manualPrice.trim() || saving} onClick={handleSaveManual}>
            {t("common.save")}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
