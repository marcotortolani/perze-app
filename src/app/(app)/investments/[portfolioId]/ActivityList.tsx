"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Amount, Button, EmptyState, ListRow, Sheet } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAssetClasses, useInstruments, useInvalidateTrades, useTrades } from "@/hooks/use-investments";
import { useInvalidateTransactions } from "@/hooks/use-transactions";
import { tradesRepo } from "@/lib/repos/trades-repo";
import { deleteSettlementTransaction, restoreSettlementTransaction } from "@/lib/investments/create-settlement-transaction";
import { formatAmount, formatNumber } from "@/lib/money/format";
import { decimalsForQuantity } from "@/lib/money/decimals";
import { fromMajorUnitsUnsafe, money } from "@/lib/money/money";
import { formatDateMedium, type Locale } from "@/i18n/formatting";

export interface ActivityListProps {
  portfolioId: string;
}

/**
 * Tab "Activity" — todas las operaciones del portfolio, de todos los
 * instrumentos juntas, en orden cronológico (a diferencia del historial
 * por instrumento de `InstrumentDetailContent`/`PositionsTable`, que
 * filtra a uno solo). Decisión tomada con el usuario: vista alternativa a
 * nivel portfolio, no reemplaza el historial por instrumento.
 */
export default function ActivityList({ portfolioId }: ActivityListProps) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: instruments } = useInstruments(household?.id);
  const { data: assetClasses } = useAssetClasses();
  const { data: trades } = useTrades(portfolioId);
  const invalidateTrades = useInvalidateTrades(portfolioId);
  const invalidateTransactions = useInvalidateTransactions(household?.id);

  // Mismo criterio que el tacho de `PositionsTable` — un tap directo sin
  // ningún paso intermedio, así que acá también es la excepción a
  // "reversible, no confirmable" (CLAUDE.md).
  const [confirmingDelete, setConfirmingDelete] = useState<{ tradeId: string; symbol: string; date: string } | null>(null);
  const [deletingTrade, setDeletingTrade] = useState(false);

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

  const instrumentById = new Map(instruments.map((i) => [i.id, i]));
  const assetClassById = new Map(assetClasses.map((a) => [a.id, a]));
  const sorted = [...trades].sort((a, b) => (a.executedAt < b.executedAt ? 1 : a.executedAt > b.executedAt ? -1 : 0));

  if (sorted.length === 0) {
    return <EmptyState message={t("instrumentDetailPage.noHistory")} />;
  }

  const tradesByDay: { day: string; trades: typeof sorted }[] = [];
  for (const tr of sorted) {
    const day = tr.executedAt.slice(0, 10);
    const lastGroup = tradesByDay[tradesByDay.length - 1];
    if (lastGroup && lastGroup.day === day) lastGroup.trades.push(tr);
    else tradesByDay.push({ day, trades: [tr] });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {tradesByDay.map(({ day, trades: dayTrades }) => (
        <div key={day}>
          <div style={{ padding: "16px 14px 6px" }}>
            <span className="t-label" style={{ color: "var(--text-secondary)" }}>{formatDateMedium(locale, new Date(dayTrades[0]!.executedAt))}</span>
          </div>
          {dayTrades.map((tr) => {
            const instrument = instrumentById.get(tr.instrumentId);
            const assetClass = instrument?.assetClassId ? assetClassById.get(instrument.assetClassId) : undefined;
            const qtyDecimals = instrument
              ? decimalsForQuantity({
                  symbol: instrument.symbol,
                  ...(assetClass?.name ? { assetClass: assetClass.name } : {}),
                  ...(instrument.quantityDecimals !== null ? { decimals: instrument.quantityDecimals } : {}),
                })
              : 2;
            // Mismo fallback que `InstrumentDetailContent`: los `kind` fuera
            // de compra/venta/posición inicial (dividendo, cupón, comisión,
            // ...) muestran el valor crudo — son mucho menos frecuentes y
            // no tienen traducción propia todavía en esta vista.
            const kindLabel = tr.kind === "buy" ? t("newTradePage.buy") : tr.kind === "sell" ? t("newTradePage.sell") : tr.kind === "transfer_in" ? t("newTradePage.transferIn") : tr.kind;
            return (
              <ListRow
                key={tr.id}
                icon={tr.kind === "sell" || tr.kind === "transfer_out" ? "minus" : "plus"}
                label={instrument ? `${instrument.symbol} — ${kindLabel}` : kindLabel}
                meta={`${formatNumber(tr.quantity, qtyDecimals)} × ${formatAmount(money(fromMajorUnitsUnsafe(tr.price, tr.currencyCode), tr.currencyCode), { showSign: false })}`}
                variant="value"
                value={<Amount value={money(tr.netAmount, tr.currencyCode)} size="body" showSign={false} polarity="neutral" tabular />}
                right={
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => router.push(`/investments/${portfolioId}/trades/${tr.id}/edit`)}
                      style={{ background: "none", border: 0, padding: "4px 6px", cursor: "pointer", color: "var(--primary-ink)", font: "500 13px/18px var(--font-sans)" }}
                    >
                      {t("positionsTablePage.editTrade")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete({ tradeId: tr.id, symbol: instrument?.symbol ?? tr.instrumentId, date: tr.executedAt })}
                      style={{ background: "none", border: 0, padding: "4px 6px", cursor: "pointer", color: "var(--critical)", font: "500 13px/18px var(--font-sans)" }}
                    >
                      {t("positionsTablePage.deleteTrade")}
                    </button>
                  </div>
                }
              />
            );
          })}
        </div>
      ))}

      <Sheet open={!!confirmingDelete} title={t("positionsTablePage.confirmDeleteOperation")} onClose={() => setConfirmingDelete(null)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p className="t-body" style={{ color: "var(--text-secondary)" }}>
            {confirmingDelete ? t("positionsTablePage.confirmDeleteOperationWarning", { symbol: confirmingDelete.symbol, date: formatDateMedium(locale, new Date(confirmingDelete.date)) }) : null}
          </p>
          <Button
            variant="danger"
            disabled={deletingTrade}
            onClick={async () => {
              if (!confirmingDelete) return;
              setDeletingTrade(true);
              try {
                await handleDeleteTrade(confirmingDelete.tradeId);
                setConfirmingDelete(null);
              } finally {
                setDeletingTrade(false);
              }
            }}
          >
            {t("positionsTablePage.deleteTrade")}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
