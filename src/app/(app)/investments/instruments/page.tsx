"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button, EmptyState, Icon, Input, ListRow, PriceStatus, Sheet, Skeleton, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useInstruments, useInvalidateInstruments, useLatestPrices, usePortfolios, useTrades } from "@/hooks/use-investments";
import { computePositions } from "@/lib/analytics/positions";
import { instrumentsRepo, type Instrument } from "@/lib/repos/instruments-repo";
import { priceSnapshotsRepo, type LatestPrice } from "@/lib/repos/price-snapshots-repo";
import { useCachedLatestPrices } from "@/hooks/use-cached-latest-prices";
import { useQueryClient } from "@tanstack/react-query";

const STALE_HOURS = 24;

function classify(asOf: string | undefined, provider: string | undefined): { state: "fresh" | "stale" | "manual"; ageHours: number } {
  if (!asOf) return { state: "manual", ageHours: 0 };
  const ageHours = Math.round((Date.now() - new Date(asOf).getTime()) / (1000 * 60 * 60));
  if (provider === "manual") return { state: "manual", ageHours };
  return { state: ageHours > STALE_HOURS ? "stale" : "fresh", ageHours };
}

/**
 * I12 — "Instrumentos": antes "Estado de los precios" (D34/redesign). Los
 * precios siempre son los de mercado — lo único que importa mostrar acá es
 * el catálogo en dos grupos: lo que ya está en el portfolio (obligado,
 * porque son los precios que de todas formas hay que actualizar) y lo que
 * se sigue sin haber comprado nada ("seguimiento"). "Agregar instrumento"
 * vive acá y ya no en el overview del portfolio (`OverviewContent`) — es
 * el mismo buscador de I7, no una segunda forma de crearlo.
 *
 * "Actualizar" en el header dispara el mismo refresh en vivo que ya corre
 * solo al entrar — acá nunca se edita un valor a mano, son datos reales de
 * mercado; el precio manual sigue siendo la excepción para lo que ningún
 * proveedor cubre (FCI, plazo fijo, inmuebles).
 */
export default function InstrumentsListPage() {
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
  // D36 — mismo cache persistido que el overview/detalle: último precio
  // conocido mientras la consulta real todavía no resolvió.
  const prices = useCachedLatestPrices(pricesQuery.data);
  const [editing, setEditing] = useState<{ instrumentId: string; symbol: string; currencyCode: string; deletable: boolean } | null>(null);
  const [manualPrice, setManualPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const providerInstrumentIds = useMemo(() => (instruments ?? []).filter((i) => i.priceProvider).map((i) => i.id), [instruments]);

  const refreshAll = useCallback(async () => {
    if (providerInstrumentIds.length === 0) return;
    const results = await Promise.all(providerInstrumentIds.map((id) => priceSnapshotsRepo.refreshFromProvider(id).then((quote) => [id, quote] as const)));
    // Escribe directo en el cache de `useLatestPrices` (mismo criterio que
    // `OverviewContent`) — el hook de arriba lo persiste solo apenas
    // cambia, sin un segundo state local para lo mismo.
    queryClient.setQueryData<Map<string, LatestPrice>>(["latest-prices", [...instrumentIds].sort()], (old) => {
      const merged = new Map(old ?? []);
      for (const [id, quote] of results) if (quote) merged.set(id, quote);
      return merged;
    });
  }, [providerInstrumentIds, instrumentIds, queryClient]);

  // Live refresh al entrar — ver el comentario de cabecera. `refreshAll` ya
  // está memoizado por `providerInstrumentIds` (no por referencia nueva en
  // cada render), así que este efecto no reintenta en loop.
  useEffect(() => {
    let cancelled = false;
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
    title: t("instrumentsListPage.title"),
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

  // `pricesQuery.isLoading` deliberadamente no bloquea (D36, ver `OverviewContent`).
  if (!household || !portfolios || !trades || !instruments) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  if (instruments.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <EmptyState message={t("instrumentsListPage.empty")} />
      </div>
    );
  }

  const positions = computePositions(trades.map((tr) => ({ instrumentId: tr.instrumentId, kind: tr.kind, quantity: tr.quantity, netAmount: tr.netAmount })));
  const held: Instrument[] = [];
  const watchlist: Instrument[] = [];
  for (const instrument of instruments) {
    const position = positions.get(instrument.id);
    (position && position.quantity !== 0 ? held : watchlist).push(instrument);
  }

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
      toast(t("instrumentsListPage.removed", { symbol: editing.symbol }));
      setEditing(null);
    } finally {
      setDeleting(false);
    }
  };

  const renderRow = (instrument: Instrument) => {
    const price = prices.get(instrument.id);
    const { state, ageHours } = classify(price?.asOf, price?.provider);
    const deletable = instrument.householdId === household.id && watchlist.includes(instrument);
    return (
      <ListRow
        key={instrument.id}
        label={instrument.symbol}
        meta={instrument.name}
        // `right`, no `value` — con la fila ahora clickeable (va al detalle
        // del instrumento) el botón de `PriceStatus` no puede vivir en
        // `value`, que la convertiría en un <button> conteniendo otro
        // botón. `right` fuerza el div clickeable (ver comentario del
        // componente) y es exactamente el caso que documenta.
        onClick={portfolio ? () => router.push(`/investments/${portfolio.id}/positions/${instrument.id}`) : undefined}
        right={
          // El `stopPropagation` es necesario: sin él, tocar "actualizar"
          // también dispara la navegación de la fila (mismo criterio que
          // `more/rules/page.tsx`).
          <span onClick={(e) => e.stopPropagation()}>
            <PriceStatus
              state={state}
              ageHours={ageHours}
              onUpdate={() => setEditing({ instrumentId: instrument.id, symbol: instrument.symbol, currencyCode: instrument.currencyCode, deletable })}
            />
          </span>
        }
      />
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", paddingBottom: 24 }}>
        {held.length > 0 ? (
          <>
            <div className="t-caption" style={{ color: "var(--text-muted)", padding: "8px 0 4px" }}>{t("instrumentsListPage.sectionPortfolio")}</div>
            {held.map(renderRow)}
          </>
        ) : null}
        {watchlist.length > 0 ? (
          <>
            <div className="t-caption" style={{ color: "var(--text-muted)", padding: "16px 0 4px" }}>{t("instrumentsListPage.sectionWatchlist")}</div>
            {watchlist.map(renderRow)}
          </>
        ) : null}
        {portfolio ? (
          <ListRow icon="plus" label={t("instrumentsListPage.addInstrument")} variant="action" onClick={() => router.push(`/investments/${portfolio.id}/instruments/new`)} />
        ) : null}
      </div>

      <Sheet open={editing !== null} title={editing ? t("instrumentsListPage.updatePrice", { symbol: editing.symbol }) : ""} onClose={() => setEditing(null)}>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label={t("instrumentsListPage.price", { currency: editing.currencyCode })} value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} autoFocus />
            <Button disabled={!manualPrice.trim() || saving} onClick={handleSaveManual}>
              {t("common.save")}
            </Button>
            {editing.deletable ? (
              <Button variant="danger" disabled={deleting} onClick={handleDelete}>
                {t("instrumentsListPage.removeFromList")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
