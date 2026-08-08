"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Amount, Button, EmptyState, Icon, IconButton, Input, ListRow, NeedsFxBanner, PositionRow, SegmentedControl, Sheet, Skeleton, usePageHeader } from "@/design-system";
import { Donut } from "@/design-system/charts";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useAssetClasses, useInstruments, useInvalidatePortfolios, useLatestPrices, usePortfolios, useTrades } from "@/hooks/use-investments";
import { useAssetClassLabel } from "@/hooks/use-asset-class-label";
import { computePositions } from "@/lib/analytics/positions";
import { formatAmountCompact, formatNumber } from "@/lib/money/format";
import { decimalsForQuantity } from "@/lib/money/decimals";
import { fromMajorUnitsUnsafe, money } from "@/lib/money/money";
import { fxRepo } from "@/lib/repos/fx-repo";
import { convert } from "@/lib/fx/rate";
import { todayIso } from "@/lib/repos/ids";
import type { FxResolution } from "@/lib/fx/resolve";
import { portfoliosRepo } from "@/lib/repos/portfolios-repo";
import { priceSnapshotsRepo, type LatestPrice } from "@/lib/repos/price-snapshots-repo";
import { FOREGROUND_REFRESH_MS } from "@/lib/prices/refresh-cadence";
import { useDateFormatPreference } from "@/stores/format-preferences-store";
import { formatNumericDate, formatTimeOfDay, type Locale } from "@/i18n/formatting";
import { useCachedLatestPrices } from "@/hooks/use-cached-latest-prices";

export interface OverviewContentProps {
  portfolioId: string;
  /**
   * `false` mientras el detalle de una posición está abierto al lado en
   * split de escritorio — sin esto, el refresco de precios en vivo
   * (`refreshPrices`, más abajo) reintroduce un `usePageHeader` propio en
   * cada tick y le arrebata el título al detalle, que quedó seleccionado
   * pero ya no aparece en el header (ver la nota larga en
   * `usePageHeader`). En mobile (`Modal contained`, sin `DetailHeaderBridge`
   * montado) siempre queda en `true`.
   */
  ownsHeader?: boolean;
}

/**
 * I2/I3 — overview de UN portfolio: composición por clase de activo
 * (Donut) + valor total + posiciones. Antes esto vivía en `/investments`
 * a secas y asumía "el primer portfolio del household"
 * (`portfolios?.[0]`) — ahora `portfolioId` viene de la URL
 * (`/investments/[portfolioId]`, la ruta que ya elige `PortfoliosListContent`),
 * así que un household con más de un portfolio los distingue de verdad.
 */
export default function OverviewContent({ portfolioId, ownsHeader = true }: OverviewContentProps) {
  const t = useTranslations();
  const assetClassLabel = useAssetClassLabel();
  const locale = useLocale() as Locale;
  const dateFormat = useDateFormatPreference();
  const router = useRouter();
  const userId = useEffectiveUserId();
  const { data: household } = useCurrentHousehold();
  const { data: portfolios } = usePortfolios(household?.id);
  const { data: assetClasses } = useAssetClasses();
  const { data: instruments } = useInstruments(household?.id);
  const invalidatePortfolios = useInvalidatePortfolios(household?.id);

  const portfolio = portfolios?.find((p) => p.id === portfolioId);
  const { data: trades } = useTrades(portfolio?.id);

  const [editingPortfolio, setEditingPortfolio] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [deletingPortfolio, setDeletingPortfolio] = useState(false);
  // Un portfolio con operaciones cargadas no se puede eliminar — son
  // movimientos reales y no se tocan (mismo criterio que apagar un
  // módulo, CLAUDE.md). El botón directamente no se dibuja en ese caso
  // (nunca deshabilitado con una razón escondida, mismo criterio de A2).
  const canDeletePortfolio = trades ? trades.length === 0 : false;

  const handleOpenEdit = () => {
    setNameInput(portfolio?.name ?? "");
    setEditingPortfolio(true);
  };

  const handleSaveName = async () => {
    if (!portfolio || !nameInput.trim() || savingName) return;
    setSavingName(true);
    try {
      await portfoliosRepo.rename(portfolio.id, nameInput.trim());
      invalidatePortfolios();
      setEditingPortfolio(false);
    } finally {
      setSavingName(false);
    }
  };

  const handleDeletePortfolio = async () => {
    if (!portfolio || !canDeletePortfolio || deletingPortfolio) return;
    setDeletingPortfolio(true);
    try {
      await portfoliosRepo.softDelete(portfolio.id);
      invalidatePortfolios();
      toast(t("investmentsPage.portfolioDeleted", { name: portfolio.name }));
      // `back()`, no `replace`/`push` — la lista ya está en el historial
      // justo debajo (mismo criterio que `goals/[id]/page.tsx`).
      router.back();
    } finally {
      setDeletingPortfolio(false);
    }
  };

  usePageHeader(
    {
      title: portfolio?.name ?? t("nav.investments"),
      onBack: () => router.push("/investments"),
      backLabel: t("ds.appHeader.back"),
      right: portfolio ? <IconButton icon="edit" ariaLabel={t("investmentsPage.editPortfolio")} onClick={handleOpenEdit} /> : undefined,
    },
    { enabled: ownsHeader }
  );
  const instrumentIds = useMemo(() => [...new Set((trades ?? []).map((tr) => tr.instrumentId))], [trades]);
  const pricesQuery = useLatestPrices(instrumentIds);
  // D36 — el último valor de mercado conocido (localStorage) rellena el
  // hueco mientras `pricesQuery` todavía no resolvió o la API falló, para
  // no mostrar nunca "$ 0,00" por una demora o un corte de red — ver el
  // comentario del store.
  const prices = useCachedLatestPrices(pricesQuery.data);
  const queryClient = useQueryClient();
  const [viewCurrency, setViewCurrency] = useState<"original" | "base">("original");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const instrumentById = useMemo(() => new Map((instruments ?? []).map((i) => [i.id, i])), [instruments]);
  const providerInstrumentIds = useMemo(() => instrumentIds.filter((id) => instrumentById.get(id)?.priceProvider), [instrumentIds, instrumentById]);
  // Escribe directo en el cache de `useLatestPrices` (misma query key que
  // usa `InstrumentDetailContent` para este mismo portfolio) en vez de
  // guardar el resultado en un state local — así el detalle de un
  // instrumento ve el precio recién pedido sin tener que volver a
  // pedirlo él mismo (D34: el refresh en vivo vive acá, no en I4).
  const refreshPrices = useCallback(async () => {
    if (providerInstrumentIds.length === 0) return;
    const results = await Promise.all(providerInstrumentIds.map((id) => priceSnapshotsRepo.refreshFromProvider(id).then((quote) => [id, quote] as const)));
    queryClient.setQueryData<Map<string, LatestPrice>>(["latest-prices", [...instrumentIds].sort()], (old) => {
      const merged = new Map(old ?? []);
      for (const [id, quote] of results) if (quote) merged.set(id, quote);
      return merged;
    });
    setLastRefreshedAt(new Date());
  }, [providerInstrumentIds, instrumentIds, queryClient]);

  // D34 — antes cada posición mostraba su propio badge "Actualizado"/
  // "Manual" (`PriceStatus`), que además nunca reflejaba un precio en
  // vivo (solo el cache de `price_snapshots`, que escribe el cron diario).
  // Ahora se pide la cotización real de mercado de todo lo que está en
  // cartera al entrar al portfolio, y la pantalla declara UN solo "última
  // actualización" en vez de un badge por fila.
  // D50 — más, cada `FOREGROUND_REFRESH_MS` mientras la pantalla sigue
  // montada: antes solo se pedía una vez al entrar, así que quedarse
  // parado en el portfolio con la pestaña abierta nunca reflejaba una
  // variación de mercado sin recargar a mano.
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      refreshPrices().catch(() => {
        if (!cancelled) return; // sin red: la pantalla sigue mostrando el cache.
      });
    };
    run();
    const interval = setInterval(run, FOREGROUND_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshPrices]);

  // Monedas de instrumentos EN CARTERA (no todo el catálogo) distintas de
  // la base — la Fase de tokens de CLAUDE.md prohíbe sumar bigints de
  // monedas distintas (`totalValue` antes sumaba el `value` crudo de cada
  // posición sin convertir, dando un número sin sentido apenas hubiera una
  // posición en una moneda != base, como un CEDEAR en ARS con base UYU).
  const heldCurrencies = useMemo(
    () => [...new Set(instrumentIds.map((id) => instrumentById.get(id)?.currencyCode).filter((c): c is string => !!c && c !== household?.baseCurrency))],
    [instrumentIds, instrumentById, household?.baseCurrency]
  );
  const fxRatesQuery = useQuery({
    queryKey: ["portfolio-fx-rates", household?.id, household?.baseCurrency, heldCurrencies],
    queryFn: async () => {
      const entries = await Promise.all(
        heldCurrencies.map(async (currency) => {
          const resolution = await fxRepo.resolve({ householdId: household!.id, base: currency, quote: household!.baseCurrency, date: todayIso() });
          return [currency, resolution] as const;
        })
      );
      return new Map<string, FxResolution>(entries);
    },
    enabled: !!household && heldCurrencies.length > 0,
  });

  if (!household || !portfolios || !assetClasses || !instruments || !userId) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  // Un `portfolioId` que no existe (más) para este household — vuelve a
  // la lista en vez de quedarse en un overview huérfano.
  if (!portfolio) {
    router.replace("/investments");
    return <Skeleton height={280} style={{ marginTop: 16 }} />;
  }

  // `pricesQuery.isLoading` deliberadamente NO bloquea el render acá — con
  // el cache persistido (D36), la pantalla ya tiene algo real para
  // mostrar aunque la consulta todavía esté en vuelo.
  if (!trades) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  const assetClassById = new Map(assetClasses.map((a) => [a.id, a]));
  const positions = computePositions(trades.map((tr) => ({ instrumentId: tr.instrumentId, kind: tr.kind, quantity: tr.quantity, netAmount: tr.netAmount })));

  /**
   * `needs_fx` para posiciones: sin rate no hay forma de sumar esta
   * posición al total en moneda base (CLAUDE.md § needs_fx) — se excluye
   * del Donut/total y se cuenta, nunca se trata como si valiera 0.
   */
  const toBase = (value: bigint, currencyCode: string): bigint | null => {
    if (currencyCode === household.baseCurrency) return value;
    const resolution = fxRatesQuery.data?.get(currencyCode);
    if (!resolution?.rate) return null;
    return convert(money(value, currencyCode), household.baseCurrency, resolution.rate).amount;
  };

  let totalValue = 0n;
  let excludedCount = 0;
  // D60 — antes una posición sin precio de mercado conocido igual sumaba
  // `0n` al total, como si de verdad valiera cero — el mismo problema de
  // fondo que needs_fx (CLAUDE.md), pero por un dato distinto (precio
  // ausente, no FX pendiente): un total que la incluye como si valiera
  // cero muestra un patrimonio falso, no uno conservador. Se excluye y se
  // cuenta aparte — nunca con el mismo contador/copy de `NeedsFxBanner`,
  // que está redactado específicamente para FX pendiente.
  let excludedNoPriceCount = 0;
  const byAssetClass = new Map<string, number>();
  for (const [instrumentId, position] of positions) {
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
      excludedCount += 1;
      continue;
    }
    totalValue += baseValue;
    const acKey = instrument.assetClassId ?? "__other";
    byAssetClass.set(acKey, (byAssetClass.get(acKey) ?? 0) + Number(baseValue));
  }

  const slices = [...byAssetClass.entries()].map(([acId, value]) => ({
    label: acId === "__other" ? t("investmentsPage.otherAssetClass") : (assetClassLabel(assetClassById.get(acId)) ?? acId),
    value,
  }));

  // El Sheet de editar/eliminar vive en las dos ramas de abajo (portfolio
  // vacío = `EmptyState` temprano, o el overview completo): es el mismo
  // botón de lápiz del header en cualquiera de las dos, y un portfolio sin
  // posiciones es justo el caso en el que SÍ se puede borrar.
  const editSheet = (
    <Sheet open={editingPortfolio} title={t("investmentsPage.editPortfolio")} onClose={() => setEditingPortfolio(false)}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Input label={t("investmentsPage.portfolioName")} value={nameInput} onChange={(e) => setNameInput(e.target.value)} autoFocus />
        <Button disabled={!nameInput.trim() || savingName} onClick={handleSaveName}>
          {t("common.save")}
        </Button>
        {canDeletePortfolio ? (
          <Button variant="danger" disabled={deletingPortfolio} onClick={handleDeletePortfolio}>
            {t("investmentsPage.deletePortfolio")}
          </Button>
        ) : (
          <p className="t-caption" style={{ margin: 0, color: "var(--text-muted)", textAlign: "center" }}>
            {t("investmentsPage.cannotDeletePortfolio")}
          </p>
        )}
      </div>
    </Sheet>
  );

  if (positions.size === 0) {
    return (
      <>
        <EmptyState message={t("investmentsPage.noPositions")} actionLabel={t("investmentsPage.recordTrade")} onAction={() => router.push(`/investments/${portfolio.id}/trades/new`)} />
        {editSheet}
      </>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 8, paddingBottom: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <Donut slices={slices} dimension={formatAmountCompact(money(totalValue, household.baseCurrency), { showSign: false })} />
      </div>

      <NeedsFxBanner count={excludedCount} />
      {/* D60 — mismo peso visual que `NeedsFxBanner` pero copy propio: es
          una causa distinta (precio de mercado ausente, no FX pendiente)
          y `NeedsFxBanner` está redactado específicamente para la otra. */}
      {excludedNoPriceCount > 0 ? (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px var(--screen-padding)",
            background: "color-mix(in srgb, var(--warning) 12%, transparent)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <Icon name="alert" size={15} strokeWidth={2} color="var(--warning)" />
          <span>{t("investmentsPage.excludedNoPrice", { count: excludedNoPriceCount })}</span>
        </div>
      ) : null}

      <ListRow icon="plus" label={t("investmentsPage.recordTrade")} variant="action" onClick={() => router.push(`/investments/${portfolio.id}/trades/new`)} />
      {/* `?portfolio=` en las tres que son por-portfolio: sin esto asumían
          `portfolios?.[0]` puertas adentro (bug real en un household con
          más de un portfolio, que el schema y el repo ya soportan). */}
      <ListRow icon="target" label={t("allocationPage.title")} onClick={() => router.push(`/investments/allocation?portfolio=${portfolio.id}`)} />
      <ListRow icon="trend" label={t("performancePage.title")} onClick={() => router.push(`/investments/performance?portfolio=${portfolio.id}`)} />
      <ListRow icon="calendar" label={t("futureIncomePage.title")} onClick={() => router.push(`/investments/future-income?portfolio=${portfolio.id}`)} />
      {/* "Agregar instrumento" se movió adentro de "Instrumentos" — ya no
          hace falta un segundo acceso acá (queda: mi portfolio →
          Instrumentos → Agregar instrumento). */}
      <ListRow icon="invest" label={t("instrumentsListPage.title")} onClick={() => router.push(`/investments/instruments?portfolio=${portfolio.id}`)} />
      {/* Asset classes es del household, no del portfolio — sin param. */}
      <ListRow icon="tag" label={t("assetClassesPage.title")} onClick={() => router.push("/investments/asset-classes")} />

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, gap: 12 }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("investmentsPage.positions")}</div>
          {/* Solo si hay algo que convertir: con todo en la moneda base el
              toggle no cambiaría nada y sería puro ruido. */}
          {heldCurrencies.length > 0 ? (
            <SegmentedControl
              options={[
                { id: "original", label: t("investmentsPage.viewOriginalCurrency") },
                { id: "base", label: t("investmentsPage.viewBaseCurrency", { currency: household.baseCurrency }) },
              ]}
              value={viewCurrency}
              onChange={(v) => setViewCurrency(v as "original" | "base")}
            />
          ) : null}
        </div>
        {/* Un solo indicador de frescura por PANTALLA, no uno por fila
            (D34) — declara cuándo se pidió el precio real por última vez
            en vez de que cada posición lleve su propio "Actualizado"/
            "Manual", que además nunca reflejaba el mercado en vivo. */}
        {lastRefreshedAt ? (
          <div className="t-caption" style={{ color: "var(--text-muted)", marginBottom: 12 }}>
            {t("investmentsPage.lastRefreshed", { date: formatNumericDate(locale, lastRefreshedAt, dateFormat), time: formatTimeOfDay(locale, lastRefreshedAt) })}
          </div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {[...positions.values()].map((position) => {
            const instrument = instrumentById.get(position.instrumentId);
            if (!instrument) return null;
            const price = prices.get(position.instrumentId);
            const assetClass = instrument.assetClassId ? assetClassById.get(instrument.assetClassId) : undefined;
            const value = price ? fromMajorUnitsUnsafe(position.quantity * price.close, instrument.currencyCode) : 0n;
            const changePct = price && Number(position.costBasis) > 0 ? ((Number(value) - Number(position.costBasis)) / Number(position.costBasis)) * 100 : 0;
            const baseValue = viewCurrency === "base" ? toBase(value, instrument.currencyCode) : null;
            // D49 — sin ningún precio conocido todavía (ni cache ni API), un
            // "$0,00" es un dato inventado, no un valor real: se muestra
            // "—" en su lugar hasta que haya un primer dato de verdad.
            const displayValue = !price ? (
              <span className="t-caption" style={{ color: "var(--text-muted)" }}>—</span>
            ) : viewCurrency === "base" ? (
              baseValue !== null ? (
                <Amount value={money(baseValue, household.baseCurrency)} size="body" showSign={false} polarity="neutral" tabular />
              ) : (
                <span className="t-caption" style={{ color: "var(--text-muted)" }}>{t("investmentsPage.pendingFx")}</span>
              )
            ) : (
              <Amount value={money(value, instrument.currencyCode)} size="body" showSign={false} polarity="neutral" tabular />
            );
            return (
              <PositionRow
                key={position.instrumentId}
                symbol={instrument.symbol}
                assetClass={assetClassLabel(assetClass) ?? t("investmentsPage.otherAssetClass")}
                quantity={formatNumber(
                  position.quantity,
                  decimalsForQuantity({
                    symbol: instrument.symbol,
                    ...(assetClass?.name ? { assetClass: assetClass.name } : {}),
                    ...(instrument.quantityDecimals !== null ? { decimals: instrument.quantityDecimals } : {}),
                  })
                )}
                price={price ? formatAmountCompact(money(fromMajorUnitsUnsafe(price.close, instrument.currencyCode), instrument.currencyCode), { showSign: false }) : "—"}
                value={displayValue}
                changePct={price ? <span>{changePct >= 0 ? "↑" : "↓"} {formatNumber(Math.abs(changePct), 1)}%</span> : undefined}
                // master-detail — search param, no ruta propia (ver la nota larga en
                // `[portfolioId]/page.tsx`). `{ scroll: false }`: seleccionar
                // una posición no debe saltar el scroll de la lista al tope.
                onClick={() => router.push(`/investments/${portfolio.id}?position=${instrument.id}`, { scroll: false })}
              />
            );
          })}
        </div>
      </div>
      {editSheet}
    </div>
  );
}
