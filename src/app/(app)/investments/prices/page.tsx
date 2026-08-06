"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button, EmptyState, Icon, Input, ListRow, PriceStatus, Sheet, Skeleton, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useInstruments, useInvalidateInstruments, useLatestPrices, usePortfolios, useTrades } from "@/hooks/use-investments";
import { computePositions } from "@/lib/analytics/positions";
import { instrumentsRepo } from "@/lib/repos/instruments-repo";
import { priceSnapshotsRepo, type LatestPrice } from "@/lib/repos/price-snapshots-repo";
import { useQueryClient } from "@tanstack/react-query";

const STALE_HOURS = 24;

function classify(asOf: string | undefined, provider: string | undefined): { state: "fresh" | "stale" | "manual"; ageHours: number } {
  if (!asOf) return { state: "manual", ageHours: 0 };
  const ageHours = Math.round((Date.now() - new Date(asOf).getTime()) / (1000 * 60 * 60));
  if (provider === "manual") return { state: "manual", ageHours };
  return { state: ageHours > STALE_HOURS ? "stale" : "fresh", ageHours };
}

/**
 * I12 — estado de los precios: qué instrumento tiene precio fresco, viejo, o
 * cargado a mano, con acción para actualizarlo.
 *
 * D34 — antes solo listaba instrumentos con al menos una operación cargada
 * (`positions.keys()`). Ahora lista TODO el catálogo visible del household
 * (`useInstruments`, Patrón C: global + propio) — un instrumento se puede
 * querer seguir de precio sin haber comprado nada todavía, y "+" deja
 * agregar uno (mismo buscador de I7, no una segunda forma de crearlo).
 * "Actualizar" en el header dispara el mismo refresh en vivo que ya corre
 * solo al entrar — acá nunca se edita un valor a mano, son datos reales de
 * mercado; el precio manual sigue siendo la excepción para lo que ningún
 * proveedor cubre (FCI, plazo fijo, inmuebles).
 */
export default function PricesStatusPage() {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: household } = useCurrentHousehold();
  const { data: portfolios } = usePortfolios(household?.id);
  const portfolio = portfolios?.[0];
  const { data: trades } = useTrades(portfolio?.id);
  const { data: instruments } = useInstruments(household?.id);
  const invalidateInstruments = useInvalidateInstruments(household?.id);
  const instrumentIds = useMemo(() => (instruments ?? []).map((i) => i.id), [instruments]);
  const pricesQuery = useLatestPrices(instrumentIds);
  const [editing, setEditing] = useState<{ instrumentId: string; symbol: string; currencyCode: string; deletable: boolean } | null>(null);
  const [manualPrice, setManualPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [liveQuotes, setLiveQuotes] = useState<Map<string, LatestPrice>>(new Map());
  const [refreshing, setRefreshing] = useState(false);

  const providerInstrumentIds = useMemo(() => (instruments ?? []).filter((i) => i.priceProvider).map((i) => i.id), [instruments]);

  const refreshAll = useCallback(async () => {
    if (providerInstrumentIds.length === 0) return;
    const results = await Promise.all(providerInstrumentIds.map((id) => priceSnapshotsRepo.refreshFromProvider(id).then((quote) => [id, quote] as const)));
    const map = new Map<string, LatestPrice>();
    for (const [id, quote] of results) if (quote) map.set(id, quote);
    setLiveQuotes(map);
  }, [providerInstrumentIds]);

  // Live refresh al entrar — ver el comentario de cabecera. `refreshAll` ya
  // está memoizado por `providerInstrumentIds` (no por referencia nueva en
  // cada render), así que este efecto no reintenta en loop.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch en vivo genuino al entrar a la pantalla, no derivable del render
    refreshAll().catch(() => {
      if (!cancelled) return; // sin red: la pantalla sigue mostrando el cache.
    });
    return () => {
      cancelled = true;
    };
  }, [refreshAll]);

  const handleRefreshClick = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  };

  usePageHeader({
    title: t("pricesStatusPage.title"),
    onBack: () => router.back(),
    backLabel: t("ds.appHeader.back"),
    right: providerInstrumentIds.length > 0 ? (
      <button
        type="button"
        onClick={handleRefreshClick}
        disabled={refreshing}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: 0, cursor: refreshing ? "default" : "pointer", color: "var(--primary-ink)", fontSize: 13, opacity: refreshing ? 0.5 : 1 }}
      >
        <Icon name="refresh" size={16} color="var(--primary-ink)" />
        {refreshing ? t("currenciesPage.refreshing") : t("currenciesPage.refresh")}
      </button>
    ) : undefined,
  });

  if (!household || !portfolios || !trades || !instruments || pricesQuery.isLoading) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  if (instruments.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <EmptyState message={t("pricesStatusPage.empty")} />
      </div>
    );
  }

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

  const handleDelete = async () => {
    if (!editing || !editing.deletable || deleting) return;
    setDeleting(true);
    try {
      await instrumentsRepo.deleteUnused(editing.instrumentId);
      invalidateInstruments();
      toast(t("pricesStatusPage.removed", { symbol: editing.symbol }));
      setEditing(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", paddingBottom: 24 }}>
        {instruments.map((instrument) => {
          const price = liveQuotes.get(instrument.id) ?? pricesQuery.data?.get(instrument.id);
          const { state, ageHours } = classify(price?.asOf, price?.provider);
          const held = positions.get(instrument.id);
          const deletable = instrument.householdId === household.id && (!held || held.quantity === 0);
          return (
            <ListRow
              key={instrument.id}
              label={instrument.symbol}
              meta={held && held.quantity !== 0 ? t("pricesStatusPage.metaWithPosition", { name: instrument.name }) : instrument.name}
              variant="value"
              value={
                <PriceStatus
                  state={state}
                  ageHours={ageHours}
                  onUpdate={() => setEditing({ instrumentId: instrument.id, symbol: instrument.symbol, currencyCode: instrument.currencyCode, deletable })}
                />
              }
            />
          );
        })}
        {portfolio ? (
          <ListRow icon="plus" label={t("pricesStatusPage.addInstrument")} variant="action" onClick={() => router.push(`/investments/${portfolio.id}/instruments/new`)} />
        ) : null}
      </div>

      <Sheet open={editing !== null} title={editing ? t("pricesStatusPage.updatePrice", { symbol: editing.symbol }) : ""} onClose={() => setEditing(null)}>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label={t("pricesStatusPage.price", { currency: editing.currencyCode })} value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} autoFocus />
            <Button disabled={!manualPrice.trim() || saving} onClick={handleSaveManual}>
              {t("common.save")}
            </Button>
            {editing.deletable ? (
              <Button variant="danger" disabled={deleting} onClick={handleDelete}>
                {t("pricesStatusPage.removeFromList")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
