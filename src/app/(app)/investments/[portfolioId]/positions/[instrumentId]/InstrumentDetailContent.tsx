"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Amount, Button, EmptyState, IconButton, Input, ListRow, SegmentedControl, Sheet, Skeleton, usePageHeader } from "@/design-system";
import { SwipeableRow } from "@/features/movements/SwipeableRow";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAssetClasses, useInstruments, useInvalidateInstruments, useInvalidateLatestPrices, useInvalidateTrades, useLatestPrices, usePortfolios, useTrades } from "@/hooks/use-investments";
import { computePositions } from "@/lib/analytics/positions";
import { instrumentsRepo } from "@/lib/repos/instruments-repo";
import { tradesRepo } from "@/lib/repos/trades-repo";
import { priceSnapshotsRepo, type LatestPrice } from "@/lib/repos/price-snapshots-repo";
import { formatAmount, formatAmountCompact, formatNumber } from "@/lib/money/format";
import { decimalsForQuantity } from "@/lib/money/decimals";
import { fromMajorUnitsUnsafe, money } from "@/lib/money/money";
import { fxRepo } from "@/lib/repos/fx-repo";
import { convert } from "@/lib/fx/rate";
import { todayIso } from "@/lib/repos/ids";
import { FOREGROUND_REFRESH_MS } from "@/lib/prices/refresh-cadence";
import { useDateFormatPreference } from "@/stores/format-preferences-store";
import { formatDateMedium, formatNumericDate, formatTimeOfDay, type Locale } from "@/i18n/formatting";
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
  const dateFormat = useDateFormatPreference();
  const router = useRouter();
  const queryClient = useQueryClient();
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
  const invalidateTrades = useInvalidateTrades(portfolioId);

  const [editingPrice, setEditingPrice] = useState(false);
  const [manualPrice, setManualPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [viewCurrency, setViewCurrency] = useState<"original" | "base">("original");
  const [confirmingDeletePosition, setConfirmingDeletePosition] = useState(false);
  const [deletingPosition, setDeletingPosition] = useState(false);

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

  // D56 — antes esta pantalla NUNCA pedía el precio en vivo por sí misma:
  // solo mostraba lo que `OverviewContent`/`instruments/page.tsx` hubieran
  // cacheado al montarse ellas. Entrar acá por link directo con ese cache
  // vencido (o nunca escrito) mostraba un precio viejo sin que nada lo
  // avisara. Mismo criterio de escritura que esas dos pantallas: al cache
  // de `useLatestPrices` (esta query, para lo que esté montado ahora) y,
  // vía el efecto de `useCachedLatestPrices` de arriba, al store
  // persistido (D36) para la próxima visita.
  const hasPriceProvider = !!instrument?.priceProvider;
  const refreshPrice = useCallback(async () => {
    if (!hasPriceProvider) return;
    const quote = await priceSnapshotsRepo.refreshFromProvider(instrumentId);
    if (!quote) return;
    queryClient.setQueryData<Map<string, LatestPrice>>(["latest-prices", [...instrumentIds].sort()], (old) => {
      const merged = new Map(old ?? []);
      merged.set(instrumentId, quote);
      return merged;
    });
    setLastRefreshedAt(new Date());
  }, [hasPriceProvider, instrumentId, instrumentIds, queryClient]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      refreshPrice().catch(() => {
        if (!cancelled) return; // sin red: la pantalla sigue mostrando el cache.
      });
    };
    run();
    const interval = setInterval(run, FOREGROUND_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshPrice]);

  const handleRefreshClick = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshPrice();
    } finally {
      setRefreshing(false);
    }
  };

  usePageHeader({
    title: instrument?.symbol ?? t("nav.investments"),
    onBack: () => router.back(),
    backLabel: t("ds.appHeader.back"),
    right:
      instrument?.priceProvider || canRemoveFromWatchlist ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {instrument?.priceProvider ? (
            <IconButton icon="refresh" ariaLabel={t("currenciesPage.refresh")} onClick={handleRefreshClick} disabled={refreshing} />
          ) : null}
          {canRemoveFromWatchlist ? (
            <IconButton icon="bookmark" ariaLabel={t("instrumentDetailPage.removeFromWatchlist")} onClick={handleRemoveFromWatchlist} disabled={removing} />
          ) : null}
        </div>
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
    const inst = instruments.find((i) => i.id === id);
    if (p && inst) portfolioTotalValue += fromMajorUnitsUnsafe(pos.quantity * p.close, inst.currencyCode);
  }

  const value = position && price ? fromMajorUnitsUnsafe(position.quantity * price.close, instrument.currencyCode) : 0n;
  const unrealizedPnl = position ? value - position.costBasis : 0n;
  const avgPrice = position && position.quantity > 0 ? Number(position.costBasis) / position.quantity : null;
  const weightPct = portfolioTotalValue > 0n ? (Number(value) / Number(portfolioTotalValue)) * 100 : 0;
  // D49 — una posición HELD sin precio conocido todavía no vale "$0,00":
  // ese cero es inventado (y el P&L resultante, `0n - costBasis`, se vería
  // como una pérdida del 100% que tampoco es real). Se muestra "—" en vez
  // de arrastrar el fallback de "pendiente de cotización" (que es para FX,
  // no para precio de mercado ausente — dos causas distintas).
  const heldWithoutPrice = !!position && position.quantity > 0 && !price;

  // D39 — mismos montos, en la moneda elegida por el toggle. `null` =
  // pendiente de cotización (needs_fx), nunca un valor inventado.
  const displayCurrency = viewCurrency === "base" ? household.baseCurrency : instrument.currencyCode;
  const toDisplay = (v: bigint): bigint | null => (viewCurrency === "base" ? toBase(v) : v);
  const displayValue = toDisplay(value);
  const displayUnrealizedPnl = toDisplay(unrealizedPnl);
  // `avgPrice` ya está en unidades mínimas (viene de `costBasis`, bigint) —
  // acá no hace falta `fromMajorUnitsUnsafe`. `price.close` sí, viene
  // crudo del proveedor en unidades mayores (D45).
  const displayAvgPrice = avgPrice !== null ? toDisplay(BigInt(Math.round(avgPrice))) : null;
  const displayCurrentPrice = price ? toDisplay(fromMajorUnitsUnsafe(price.close, instrument.currencyCode)) : null;

  const instrumentTrades = trades.filter((tr) => tr.instrumentId === instrumentId).sort((a, b) => (a.executedAt < b.executedAt ? 1 : -1));

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

  // "Reversible, no confirmable" (CLAUDE.md): borrar UNA operación ofrece
  // deshacer por toast, como el resto de la app — `SwipeableRow` ya exige
  // su propio paso de confirmación en el gesto (swipe hasta el commit +
  // confirmación en la fila), así que un segundo diálogo modal encima
  // sería redundante.
  const handleDeleteTrade = async (tradeId: string) => {
    await tradesRepo.softDelete(tradeId);
    invalidateTrades();
    toast(t("instrumentDetailPage.tradeDeleted"), {
      duration: 5000,
      action: {
        label: t("common.undo"),
        onClick: async () => {
          await tradesRepo.restore(tradeId);
          invalidateTrades();
        },
      },
    });
  };

  // Eliminar la POSICIÓN completa sí es la excepción explícita a
  // "reversible, no confirmable": borra TODAS las operaciones del
  // instrumento en este portfolio de una vez (no hay "deshacer" razonable
  // para un borrado en lote), así que lleva un `Sheet` de advertencia con
  // el conteo real de operaciones afectadas antes de ejecutar.
  const handleDeletePosition = async () => {
    if (!instrument || deletingPosition) return;
    setDeletingPosition(true);
    try {
      await Promise.all(instrumentTrades.map((tr) => tradesRepo.softDelete(tr.id)));
      invalidateTrades();
      // Después de borrar todas las operaciones, la posición queda en 0 —
      // mismo criterio que "sacar de seguimiento" del header: solo se
      // limpia del catálogo si es propio del household, nunca uno global.
      if (instrument.householdId === household!.id) {
        await instrumentsRepo.deleteUnused(instrument.id);
        invalidateInstruments();
      }
      toast(t("instrumentDetailPage.positionDeleted", { symbol: instrument.symbol }));
      setConfirmingDeletePosition(false);
      router.push(`/investments/${portfolioId}`);
    } finally {
      setDeletingPosition(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingTop: 8, paddingBottom: 24 }}>
      <div style={{ textAlign: "center" }}>
        <div className="t-caption" style={{ color: "var(--text-muted)" }}>{assetClass?.name ?? t("investmentsPage.otherAssetClass")}</div>
        <div className="t-hero" style={{ margin: "8px 0 0" }}>
          {heldWithoutPrice ? (
            <span className="t-caption" style={{ color: "var(--text-muted)" }}>—</span>
          ) : displayValue !== null ? (
            <Amount value={money(displayValue, displayCurrency)} size="hero" showSign={false} polarity="neutral" tabular />
          ) : (
            <span className="t-caption" style={{ color: "var(--text-muted)" }}>{t("investmentsPage.pendingFx")}</span>
          )}
        </div>
        <div style={{ marginTop: 4 }}>
          {heldWithoutPrice ? (
            <span className="t-caption" style={{ color: "var(--text-muted)" }}>—</span>
          ) : displayUnrealizedPnl !== null ? (
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

      <div>
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
          </div>
          <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 14 }}>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("instrumentDetailPage.weight")}</div>
            <div className="t-title" style={{ marginTop: 4 }}>{formatNumber(weightPct, 1)}%</div>
          </div>
        </div>

        {/* D56 — mismo criterio que `OverviewContent`: un solo indicador de
            frescura por pantalla, no un badge por dato. */}
        {lastRefreshedAt ? (
          <div className="t-caption" style={{ color: "var(--text-muted)", marginTop: 8 }}>
            {t("investmentsPage.lastRefreshed", { date: formatNumericDate(locale, lastRefreshedAt, dateFormat), time: formatTimeOfDay(locale, lastRefreshedAt) })}
          </div>
        ) : null}
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
              // D54 — mismo gesto que Transactions (D1): swipe izquierda
              // borra (con su propia confirmación en la fila), swipe
              // derecha edita. El tap normal en la fila sigue sin hacer
              // nada acá — a diferencia de Transactions, esta lista no
              // tiene un detalle propio por operación, solo editar/borrar.
              <SwipeableRow
                key={tr.id}
                onSwipeLeftCommit={() => handleDeleteTrade(tr.id)}
                onSwipeRightCommit={() => router.push(`/investments/${portfolioId}/trades/${tr.id}/edit`)}
                confirmLabel={t("instrumentDetailPage.confirmDeleteTrade")}
                confirmActionLabel={t("common.delete")}
              >
                <ListRow
                  icon={tr.kind === "buy" ? "plus" : "minus"}
                  label={tr.kind === "buy" ? t("newTradePage.buy") : tr.kind === "sell" ? t("newTradePage.sell") : tr.kind}
                  // D61 — mismo formato de fecha que Transactions (día abreviado
                  // a 3 letras) y precio unitario SIN abreviar: `formatAmountCompact`
                  // redondeaba a "K"/"M" un precio en pesos de varios dígitos
                  // (ej. "AR$ 24,7 K" en vez de "AR$ 24.660,00"), justo el dato
                  // que esta línea existe para mostrar completo.
                  meta={`${formatDateMedium(locale, new Date(tr.executedAt))} · ${formatNumber(tr.quantity, decimalsForQuantity({ symbol: instrument.symbol, ...(assetClass?.name ? { assetClass: assetClass.name } : {}) }))} × ${formatAmount(money(fromMajorUnitsUnsafe(tr.price, tr.currencyCode), tr.currencyCode), { showSign: false })}`}
                  variant="value"
                  value={<Amount value={money(tr.netAmount, tr.currencyCode)} size="body" showSign={false} polarity="neutral" tabular />}
                />
              </SwipeableRow>
            ))}
          </div>
        )}
      </div>

      {instrumentTrades.length > 0 ? (
        <Button variant="danger" onClick={() => setConfirmingDeletePosition(true)}>
          {t("instrumentDetailPage.deletePosition")}
        </Button>
      ) : null}

      <Sheet open={editingPrice} title={t("instrumentsListPage.updatePrice", { symbol: instrument.symbol })} onClose={() => setEditingPrice(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label={t("instrumentsListPage.price", { currency: instrument.currencyCode })} value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} autoFocus />
          <Button disabled={!manualPrice.trim() || saving} onClick={handleSaveManual}>
            {t("common.save")}
          </Button>
        </div>
      </Sheet>

      {/* Excepción explícita a "reversible, no confirmable" (CLAUDE.md):
          esto borra TODAS las operaciones del instrumento de una vez, sin
          deshacer razonable, así que lleva advertencia + conteo real antes
          de ejecutar. */}
      <Sheet open={confirmingDeletePosition} title={t("instrumentDetailPage.deletePosition")} onClose={() => setConfirmingDeletePosition(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p className="t-body" style={{ color: "var(--text-secondary)" }}>
            {t("instrumentDetailPage.deletePositionWarning", { count: instrumentTrades.length, symbol: instrument.symbol })}
          </p>
          <Button variant="danger" disabled={deletingPosition} onClick={handleDeletePosition}>
            {deletingPosition ? "…" : t("instrumentDetailPage.deletePositionConfirm")}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
