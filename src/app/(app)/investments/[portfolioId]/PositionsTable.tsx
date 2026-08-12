"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Amount, DeltaPct, Icon, IconButton } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAssetClasses, useInstruments, useInvalidateTrades, useLatestPrices, usePreviousClose, useTradeLotAllocations, useTrades } from "@/hooks/use-investments";
import { useInvalidateTransactions } from "@/hooks/use-transactions";
import { useAssetClassLabel } from "@/hooks/use-asset-class-label";
import { useCachedLatestPrices } from "@/hooks/use-cached-latest-prices";
import { computePositions } from "@/lib/analytics/positions";
import { computeLots } from "@/lib/analytics/lots";
import { tradesRepo } from "@/lib/repos/trades-repo";
import { deleteSettlementTransaction, restoreSettlementTransaction } from "@/lib/investments/create-settlement-transaction";
import { formatAmount, formatAmountCompact, formatNumber } from "@/lib/money/format";
import { decimalsForQuantity } from "@/lib/money/decimals";
import { fromMajorUnitsUnsafe, money } from "@/lib/money/money";
import { formatDateMedium, type Locale } from "@/i18n/formatting";

export interface PositionsTableProps {
  portfolioId: string;
  /** Deep link (`?position=`) — la fila de este instrumento arranca expandida. */
  initialExpandedInstrumentId?: string | null | undefined;
}

const GRID_COLUMNS = "minmax(160px,1.6fr) minmax(90px,1fr) minmax(80px,0.8fr) minmax(100px,1fr) minmax(130px,1.2fr) minmax(110px,1fr) 28px";

/**
 * Tabla de posiciones estilo Google Finance — reemplaza la lista de
 * `PositionRow` de `OverviewContent` en desktop (ver la nota larga en
 * `[portfolioId]/page.tsx`). Cada fila de instrumento se expande IN PLACE
 * mostrando sus lotes (`computeLots`, ya construido en la Fase 1/2 —
 * FIFO real, venta de lote elegido, nada de esto se reinventa acá, solo
 * se presenta distinto).
 *
 * Self-contiene sus queries (mismo criterio que `OverviewContent`/
 * `InstrumentDetailContent`): las claves de React Query coinciden con las
 * de esas pantallas, así que no hay refetch de más, solo lectura
 * compartida del mismo cache.
 */
export default function PositionsTable({ portfolioId, initialExpandedInstrumentId }: PositionsTableProps) {
  const t = useTranslations();
  const assetClassLabel = useAssetClassLabel();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: instruments } = useInstruments(household?.id);
  const { data: assetClasses } = useAssetClasses();
  const { data: trades } = useTrades(portfolioId);
  const allocationsQuery = useTradeLotAllocations(trades);
  const invalidateTrades = useInvalidateTrades(portfolioId);
  const invalidateTransactions = useInvalidateTransactions(household?.id);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(initialExpandedInstrumentId ? [initialExpandedInstrumentId] : []));
  const toggleExpanded = (instrumentId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(instrumentId)) next.delete(instrumentId);
      else next.add(instrumentId);
      return next;
    });
  };

  const instrumentIds = useMemo(() => [...new Set((trades ?? []).map((tr) => tr.instrumentId))], [trades]);
  const pricesQuery = useLatestPrices(instrumentIds);
  // D36 — mismo cache persistido que `OverviewContent`: último precio
  // conocido mientras la query real no resolvió, nunca "$0,00" inventado.
  const prices = useCachedLatestPrices(pricesQuery.data);
  const previousCloseQuery = usePreviousClose(instrumentIds);
  const previousClose = previousCloseQuery.data ?? new Map<string, number>();

  const instrumentById = useMemo(() => new Map((instruments ?? []).map((i) => [i.id, i])), [instruments]);
  const assetClassById = useMemo(() => new Map((assetClasses ?? []).map((a) => [a.id, a])), [assetClasses]);

  const handleDeleteTrade = async (tradeId: string) => {
    await tradesRepo.softDelete(tradeId);
    const deletedTransactionId = await deleteSettlementTransaction(tradeId);
    invalidateTrades();
    invalidateTransactions();
    toast(t("instrumentDetailPage.tradeDeleted"), {
      duration: 5000,
      action: {
        label: t("common.undo"),
        onClick: async () => {
          await tradesRepo.restore(tradeId);
          if (deletedTransactionId) await restoreSettlementTransaction(deletedTransactionId);
          invalidateTrades();
          invalidateTransactions();
        },
      },
    });
  };

  if (!household || !instruments || !assetClasses || !trades) return null;

  const positions = computePositions(
    trades.map((tr) => ({ id: tr.id, instrumentId: tr.instrumentId, kind: tr.kind, quantity: tr.quantity, price: tr.price, netAmount: tr.netAmount, executedAt: tr.executedAt })),
    allocationsQuery.data
  );
  const { lotsByInstrument } = computeLots(
    trades.map((tr) => ({ id: tr.id, instrumentId: tr.instrumentId, kind: tr.kind, quantity: tr.quantity, price: tr.price, netAmount: tr.netAmount, executedAt: tr.executedAt })),
    allocationsQuery.data
  );

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "grid", gridTemplateColumns: GRID_COLUMNS, gap: 12, padding: "0 14px 8px", alignItems: "baseline" }}>
        <span className="t-caption" style={{ color: "var(--text-muted)" }}>{t("investmentsPage.positions")}</span>
        <span className="t-caption" style={{ color: "var(--text-muted)", textAlign: "right" }}>{t("positionsTablePage.columnPrice")}</span>
        <span className="t-caption" style={{ color: "var(--text-muted)", textAlign: "right" }}>{t("positionsTablePage.columnQuantity")}</span>
        <span className="t-caption" style={{ color: "var(--text-muted)", textAlign: "right" }}>{t("positionsTablePage.columnChange")}</span>
        <span className="t-caption" style={{ color: "var(--text-muted)", textAlign: "right" }}>{t("positionsTablePage.columnTotalGain")}</span>
        <span className="t-caption" style={{ color: "var(--text-muted)", textAlign: "right" }}>{t("positionsTablePage.columnValue")}</span>
        <span />
      </div>

      {[...positions.values()].map((position) => {
        const instrument = instrumentById.get(position.instrumentId);
        if (!instrument) return null;
        const price = prices.get(position.instrumentId);
        const prevClose = previousClose.get(position.instrumentId);
        const assetClass = instrument.assetClassId ? assetClassById.get(instrument.assetClassId) : undefined;
        const qtyDecimals = decimalsForQuantity({
          symbol: instrument.symbol,
          ...(assetClass?.name ? { assetClass: assetClass.name } : {}),
          ...(instrument.quantityDecimals !== null ? { decimals: instrument.quantityDecimals } : {}),
        });
        const value = price ? fromMajorUnitsUnsafe(position.quantity * price.close, instrument.currencyCode) : null;
        const unrealizedPnl = value !== null ? value - position.costBasis : null;
        const totalGainPct = value !== null && Number(position.costBasis) > 0 ? ((Number(value) - Number(position.costBasis)) / Number(position.costBasis)) * 100 : null;
        // "Change" del día — precio de hoy contra el cierre de ayer, no
        // contra el costo de compra (esa es "Total Gain/Loss", otra
        // pregunta). Sin cierre de ayer conocido (instrumento recién
        // agregado, o sin proveedor) no se inventa un 0%.
        const dayChangePct = price && prevClose && prevClose > 0 ? ((price.close - prevClose) / prevClose) * 100 : null;
        const dayChangeAmount = price && prevClose && dayChangePct !== null ? fromMajorUnitsUnsafe(position.quantity * (price.close - prevClose), instrument.currencyCode) : null;
        const expanded = expandedIds.has(position.instrumentId);
        const lots = (lotsByInstrument.get(position.instrumentId) ?? []).filter((l) => l.remainingQuantity > 0);

        return (
          <div key={position.instrumentId}>
            <button
              type="button"
              onClick={() => toggleExpanded(position.instrumentId)}
              style={{ display: "grid", gridTemplateColumns: GRID_COLUMNS, gap: 12, width: "100%", padding: "12px 14px", background: "none", border: 0, textAlign: "left", cursor: "pointer", alignItems: "center" }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", font: "500 15px/20px var(--font-sans)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{instrument.symbol}</span>
                <span className="t-caption" style={{ color: "var(--text-muted)" }}>{assetClassLabel(assetClass) ?? t("investmentsPage.otherAssetClass")}</span>
              </span>
              <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                {price ? formatAmountCompact(money(fromMajorUnitsUnsafe(price.close, instrument.currencyCode), instrument.currencyCode), { showSign: false }) : "—"}
              </span>
              <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{formatNumber(position.quantity, qtyDecimals)}</span>
              <span style={{ textAlign: "right" }}>
                {dayChangePct !== null && dayChangeAmount !== null ? (
                  <>
                    <DeltaPct value={dayChangePct} />
                    <div className="t-caption" style={{ color: "var(--text-muted)" }}>
                      <Amount value={money(dayChangeAmount, instrument.currencyCode)} size="label" showSign polarity="neutral" tabular />
                    </div>
                  </>
                ) : (
                  <span className="t-caption" style={{ color: "var(--text-muted)" }}>—</span>
                )}
              </span>
              <span style={{ textAlign: "right" }}>
                {totalGainPct !== null && unrealizedPnl !== null ? (
                  <>
                    <DeltaPct value={totalGainPct} />
                    <div className="t-caption" style={{ color: "var(--text-muted)" }}>
                      <Amount value={money(unrealizedPnl, instrument.currencyCode)} size="label" showSign polarity="neutral" tabular />
                    </div>
                  </>
                ) : (
                  <span className="t-caption" style={{ color: "var(--text-muted)" }}>—</span>
                )}
              </span>
              <span style={{ textAlign: "right" }}>{value !== null ? <Amount value={money(value, instrument.currencyCode)} size="body" showSign={false} polarity="neutral" tabular /> : <span className="t-caption" style={{ color: "var(--text-muted)" }}>—</span>}</span>
              <Icon name="chevron-down" size={16} color="var(--text-muted)" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform var(--duration-fast) var(--ease-spring-snappy)" }} />
            </button>

            {expanded ? (
              <div style={{ display: "flex", flexDirection: "column", paddingLeft: 14, borderLeft: "2px solid var(--surface-2)", marginLeft: 20 }}>
                {lots.map((lot) => {
                  const lotEvolutionPct = price && lot.unitPrice > 0 ? ((price.close - lot.unitPrice) / lot.unitPrice) * 100 : null;
                  const lotValue = price ? fromMajorUnitsUnsafe(lot.remainingQuantity * price.close, instrument.currencyCode) : null;
                  const lotGain = lotValue !== null ? lotValue - lot.costBasisRemaining : null;
                  const lotDayChangeAmount = dayChangePct !== null && prevClose ? fromMajorUnitsUnsafe(lot.remainingQuantity * (price!.close - prevClose), instrument.currencyCode) : null;
                  return (
                    <div key={lot.buyTradeId} style={{ display: "grid", gridTemplateColumns: `${GRID_COLUMNS} 72px`, gap: 12, padding: "10px 14px", alignItems: "center" }}>
                      <span className="t-caption" style={{ color: "var(--text-secondary)" }}>{formatDateMedium(locale, new Date(lot.executedAt))}</span>
                      <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 13, color: "var(--text-secondary)" }}>
                        {formatAmount(money(fromMajorUnitsUnsafe(lot.unitPrice, instrument.currencyCode), instrument.currencyCode), { showSign: false })}
                      </span>
                      <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 13, color: "var(--text-secondary)" }}>{formatNumber(lot.remainingQuantity, qtyDecimals)}</span>
                      <span style={{ textAlign: "right" }}>
                        {dayChangePct !== null && lotDayChangeAmount !== null ? (
                          <>
                            <DeltaPct value={dayChangePct} size={11} />
                            <div className="t-caption" style={{ color: "var(--text-muted)" }}>
                              <Amount value={money(lotDayChangeAmount, instrument.currencyCode)} size="label" showSign polarity="neutral" tabular />
                            </div>
                          </>
                        ) : (
                          <span className="t-caption" style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </span>
                      <span style={{ textAlign: "right" }}>
                        {lotEvolutionPct !== null && lotGain !== null ? (
                          <>
                            <DeltaPct value={lotEvolutionPct} size={11} />
                            <div className="t-caption" style={{ color: "var(--text-muted)" }}>
                              <Amount value={money(lotGain, instrument.currencyCode)} size="label" showSign polarity="neutral" tabular />
                            </div>
                          </>
                        ) : (
                          <span className="t-caption" style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </span>
                      <span style={{ textAlign: "right" }}>{lotValue !== null ? <Amount value={money(lotValue, instrument.currencyCode)} size="label" showSign={false} polarity="neutral" tabular /> : <span className="t-caption" style={{ color: "var(--text-muted)" }}>—</span>}</span>
                      <span />
                      <span style={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
                        <IconButton
                          icon="minus"
                          size={28}
                          iconSize={15}
                          ariaLabel={t("positionsTablePage.sellFromThisLot")}
                          onClick={() => router.push(`/investments/${portfolioId}/trades/new?instrumentId=${instrument.id}&kind=sell&lotId=${lot.buyTradeId}`)}
                        />
                        <IconButton icon="edit" size={28} iconSize={15} ariaLabel={t("positionsTablePage.editTrade")} onClick={() => router.push(`/investments/${portfolioId}/trades/${lot.buyTradeId}/edit`)} />
                        <IconButton icon="trash" size={28} iconSize={15} ariaLabel={t("positionsTablePage.deleteTrade")} onClick={() => handleDeleteTrade(lot.buyTradeId)} />
                      </span>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => router.push(`/investments/${portfolioId}/trades/new?instrumentId=${instrument.id}`)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px 14px", background: "none", border: 0, cursor: "pointer", color: "var(--primary-ink)", font: "500 13px/18px var(--font-sans)" }}
                >
                  {t("positionsTablePage.addAnotherPurchase", { symbol: instrument.symbol })}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
