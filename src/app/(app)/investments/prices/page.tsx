"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, EmptyState, Input, ListRow, PriceStatus, Sheet, Skeleton, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useInstruments, useLatestPrices, usePortfolios, useTrades } from "@/hooks/use-investments";
import { computePositions } from "@/lib/analytics/positions";
import { priceSnapshotsRepo, type LatestPrice } from "@/lib/repos/price-snapshots-repo";
import { useQueryClient } from "@tanstack/react-query";

const STALE_HOURS = 24;

function classify(asOf: string | undefined, provider: string | undefined): { state: "fresh" | "stale" | "manual"; ageHours: number } {
  if (!asOf) return { state: "manual", ageHours: 0 };
  const ageHours = Math.round((Date.now() - new Date(asOf).getTime()) / (1000 * 60 * 60));
  if (provider === "manual") return { state: "manual", ageHours };
  return { state: ageHours > STALE_HOURS ? "stale" : "fresh", ageHours };
}

/** I12 — estado de los precios: qué instrumento tiene precio fresco, viejo, o cargado a mano, con acción para actualizarlo. */
export default function PricesStatusPage() {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: household } = useCurrentHousehold();
  const { data: portfolios } = usePortfolios(household?.id);
  const portfolio = portfolios?.[0];
  const { data: trades } = useTrades(portfolio?.id);
  const { data: instruments } = useInstruments(household?.id);
  const instrumentIds = useMemo(() => [...new Set((trades ?? []).map((tr) => tr.instrumentId))], [trades]);
  const pricesQuery = useLatestPrices(instrumentIds);
  const [editing, setEditing] = useState<{ instrumentId: string; symbol: string; currencyCode: string } | null>(null);
  const [manualPrice, setManualPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [liveQuotes, setLiveQuotes] = useState<Map<string, LatestPrice>>(new Map());
  usePageHeader({ title: t("pricesStatusPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  /**
   * I12 — antes esta pantalla solo mostraba `price_snapshots` cacheado (el
   * cron diario), así que "estado de los precios" podía mostrar "viejo"
   * aunque el mercado ya tuviera un valor fresco disponible. Al entrar acá
   * se pide la cotización en vivo de cada instrumento con proveedor —
   * `refreshFromProvider` no escribe `price_snapshots` (eso lo hace el cron),
   * así que el resultado se guarda aparte y gana sobre el cache al mostrar.
   */
  const providerInstrumentIds = useMemo(
    () => (instruments ?? []).filter((i) => instrumentIds.includes(i.id) && i.priceProvider).map((i) => i.id),
    [instruments, instrumentIds]
  );
  useEffect(() => {
    if (providerInstrumentIds.length === 0) return;
    let cancelled = false;
    Promise.all(providerInstrumentIds.map((id) => priceSnapshotsRepo.refreshFromProvider(id).then((quote) => [id, quote] as const))).then((results) => {
      if (cancelled) return;
      const map = new Map<string, LatestPrice>();
      for (const [id, quote] of results) if (quote) map.set(id, quote);
      setLiveQuotes(map);
    });
    return () => {
      cancelled = true;
    };
  }, [providerInstrumentIds]);

  if (!household || !portfolios || !trades || !instruments || pricesQuery.isLoading) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  if (instrumentIds.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <EmptyState message={t("pricesStatusPage.empty")} />
      </div>
    );
  }

  const instrumentById = new Map(instruments.map((i) => [i.id, i]));
  const positions = computePositions(trades.map((tr) => ({ instrumentId: tr.instrumentId, kind: tr.kind, quantity: tr.quantity, netAmount: tr.netAmount })));

  const handleSaveManual = async () => {
    if (!editing || !manualPrice.trim() || saving) return;
    setSaving(true);
    try {
      await priceSnapshotsRepo.setManual(editing.instrumentId, Number(manualPrice.replace(",", ".")), editing.currencyCode);
      await queryClient.invalidateQueries({ queryKey: ["latest-prices"] });
      setEditing(null);
      setManualPrice("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", paddingBottom: 24 }}>
        {[...positions.keys()].map((instrumentId) => {
          const instrument = instrumentById.get(instrumentId);
          if (!instrument) return null;
          const price = liveQuotes.get(instrumentId) ?? pricesQuery.data?.get(instrumentId);
          const { state, ageHours } = classify(price?.asOf, price?.provider);
          return (
            <ListRow
              key={instrumentId}
              label={instrument.symbol}
              meta={instrument.name}
              variant="value"
              value={<PriceStatus state={state} ageHours={ageHours} onUpdate={() => setEditing({ instrumentId, symbol: instrument.symbol, currencyCode: instrument.currencyCode })} />}
            />
          );
        })}
      </div>

      <Sheet open={editing !== null} title={editing ? t("pricesStatusPage.updatePrice", { symbol: editing.symbol }) : ""} onClose={() => setEditing(null)}>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label={t("pricesStatusPage.price", { currency: editing.currencyCode })} value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} autoFocus />
            <Button disabled={!manualPrice.trim() || saving} onClick={handleSaveManual}>
              {t("common.save")}
            </Button>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
