"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, Icon, ListRow, Skeleton, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useInstruments, useLatestPrices, usePortfolioFromParam, usePortfolios, useTrades } from "@/hooks/use-investments";
import { computePositions } from "@/lib/analytics/positions";
import type { Instrument } from "@/lib/repos/instruments-repo";
import { priceSnapshotsRepo, type LatestPrice } from "@/lib/repos/price-snapshots-repo";
import { formatAmountCompact } from "@/lib/money/format";
import { fromMajorUnitsUnsafe, money } from "@/lib/money/money";
import { useCachedLatestPrices } from "@/hooks/use-cached-latest-prices";
import { FOREGROUND_REFRESH_MS } from "@/lib/prices/refresh-cadence";
import { useQueryClient } from "@tanstack/react-query";

/**
 * I12 — "Instrumentos": antes "Estado de los precios" (D34/redesign), y
 * antes de eso una lista con badge "Actualizado"/"Manual" por fila (D42
 * de esta pasada). El usuario la quiere leer como una tabla de cotizador
 * (tipo Investing): símbolo, nombre, precio de mercado — nada de estado
 * ni de acción por fila. "Manual" seguía siendo un concepto real (I12: FCI,
 * plazo fijo, inmuebles, sin proveedor), pero esta lista no es el lugar
 * para tocarlo — vive en el detalle del instrumento (I4,
 * `InstrumentDetailContent`), que ya tiene "Cargar precio a mano" para
 * instrumentos sin proveedor y "Eliminar de seguimiento" (D39). Acá el
 * precio siempre sale del cache persistido (D36) — último valor conocido,
 * refrescado por API con "Actualizar" en el header o al entrar — nunca se
 * edita en este listado.
 *
 * Lista el catálogo en dos grupos: lo que ya está en el portfolio
 * (obligado, porque son los precios que de todas formas hay que
 * mantener actualizados) y lo que se sigue sin haber comprado nada
 * ("seguimiento"). "Agregar instrumento" vive acá y ya no en el overview
 * del portfolio (`OverviewContent`) — es el mismo buscador de I7, no una
 * segunda forma de crearlo.
 */
export default function InstrumentsListPage() {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: household } = useCurrentHousehold();
  const { data: portfolios } = usePortfolios(household?.id);
  const portfolio = usePortfolioFromParam(portfolios);
  const { data: trades } = useTrades(portfolio?.id);
  const { data: instruments } = useInstruments(household?.id);
  const instrumentIds = useMemo(() => (instruments ?? []).map((i) => i.id), [instruments]);
  const pricesQuery = useLatestPrices(instrumentIds);
  // D36 — mismo cache persistido que el overview/detalle: último precio
  // conocido mientras la consulta real todavía no resolvió.
  const prices = useCachedLatestPrices(pricesQuery.data);
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

  // Live refresh al entrar y cada `FOREGROUND_REFRESH_MS` mientras la
  // pantalla sigue montada (D50) — ver el comentario de cabecera.
  // `refreshAll` ya está memoizado por `providerInstrumentIds` (no por
  // referencia nueva en cada render), así que este efecto no reintenta en loop.
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      refreshAll().catch(() => {
        if (!cancelled) return; // sin red: la pantalla sigue mostrando el cache.
      });
    };
    run();
    const interval = setInterval(run, FOREGROUND_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
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

  const positions = computePositions(trades.map((tr) => ({ id: tr.id, instrumentId: tr.instrumentId, kind: tr.kind, quantity: tr.quantity, netAmount: tr.netAmount, executedAt: tr.executedAt })));
  const held: Instrument[] = [];
  const watchlist: Instrument[] = [];
  for (const instrument of instruments) {
    const position = positions.get(instrument.id);
    (position && position.quantity !== 0 ? held : watchlist).push(instrument);
  }

  const renderRow = (instrument: Instrument) => {
    const price = prices.get(instrument.id);
    return (
      <ListRow
        key={instrument.id}
        label={instrument.symbol}
        meta={instrument.name}
        variant="value"
        value={price ? formatAmountCompact(money(fromMajorUnitsUnsafe(price.close, instrument.currencyCode), instrument.currencyCode), { showSign: false }) : "—"}
        // master-detail — search param, no ruta propia (ver `[portfolioId]/page.tsx`).
        onClick={portfolio ? () => router.push(`/investments/${portfolio.id}?position=${instrument.id}`) : undefined}
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
    </div>
  );
}
