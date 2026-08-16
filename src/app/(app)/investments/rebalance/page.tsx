"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Amount,
  Button,
  CurrencyChip,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Input,
  NeedsFxBanner,
  SegmentedControl,
  Skeleton,
  StatusBadge,
  usePageHeader,
} from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useQueryErrorState } from "@/hooks/use-query-error-state";
import {
  useAssetClasses,
  useInstruments,
  useInvalidateTargetAllocations,
  useLatestPrices,
  usePortfolioFromParam,
  usePortfolios,
  useTargetAllocations,
  useTrades,
} from "@/hooks/use-investments";
import { useAssetClassLabel } from "@/hooks/use-asset-class-label";
import { useCachedLatestPrices } from "@/hooks/use-cached-latest-prices";
import { computePositions } from "@/lib/analytics/positions";
import { valuePositionsInBase } from "@/lib/analytics/position-valuation";
import { computeRebalance, UNASSIGNED_KEY } from "@/lib/analytics/rebalance";
import { fxRepo } from "@/lib/repos/fx-repo";
import { todayIso } from "@/lib/repos/ids";
import type { FxResolution } from "@/lib/fx/resolve";
import { targetAllocationsRepo } from "@/lib/repos/target-allocations-repo";
import { money } from "@/lib/money/money";
import { formatNumber } from "@/lib/money/format";

/** Subconjunto de `TargetAllocationDimension` expuesto en esta pantalla — el schema también admite `'country' | 'instrument' | 'sector'` (paso 2 del plan: `instrument`/`sector` si el tiempo da, `country` no tiene columna en `instruments` todavía). */
type UiDimension = "asset_class" | "currency" | "risk";
const DIMENSIONS: UiDimension[] = ["asset_class", "currency", "risk"];
const RISK_ORDER = ["low", "medium", "high"];
/** Tolerancia de redondeo — 3 decimales (`target_pct` es `numeric(6,3)`), no exigimos 100,000 exacto. */
const SUM_EPSILON = 0.01;

interface DraftRow {
  key: string;
  targetPct: string; // input crudo, se parsea al guardar
  bandPct: number;
}

/**
 * I-rebalance — asesoramiento de cartera contra un objetivo por %, en la
 * dimensión que el usuario elija (CLAUDE.md: clase de activo, riesgo,
 * moneda son vistas independientes que suman 100% cada una por su cuenta).
 * No ejecuta nada: sugiere monto a comprar/vender, sin integración de
 * broker.
 */
export default function RebalancePage() {
  const t = useTranslations();
  const router = useRouter();
  const assetClassLabel = useAssetClassLabel();
  const { data: household } = useCurrentHousehold();
  const { data: portfolios } = usePortfolios(household?.id);
  const portfolio = usePortfolioFromParam(portfolios);
  const tradesQuery = useTrades(portfolio?.id);
  const trades = tradesQuery.data;
  const assetClassesQuery = useAssetClasses();
  const assetClasses = assetClassesQuery.data;
  const instrumentsQuery = useInstruments(household?.id);
  const instruments = instrumentsQuery.data;
  const instrumentIds = useMemo(() => [...new Set((trades ?? []).map((tr) => tr.instrumentId))], [trades]);
  const pricesQuery = useLatestPrices(instrumentIds);
  const prices = useCachedLatestPrices(pricesQuery.data);

  const [dimension, setDimension] = useState<UiDimension>("asset_class");
  const targetsQuery = useTargetAllocations(portfolio?.id, dimension);
  const invalidateTargets = useInvalidateTargetAllocations(portfolio?.id, dimension);

  const instrumentById = useMemo(() => new Map((instruments ?? []).map((i) => [i.id, i])), [instruments]);
  const assetClassById = useMemo(() => new Map((assetClasses ?? []).map((a) => [a.id, a])), [assetClasses]);
  const heldCurrencies = useMemo(
    () => [...new Set(instrumentIds.map((id) => instrumentById.get(id)?.currencyCode).filter((c): c is string => !!c && c !== household?.baseCurrency))],
    [instrumentIds, instrumentById, household?.baseCurrency]
  );
  const fxRatesQuery = useQuery({
    queryKey: ["portfolio-fx-rates", household?.id, household?.baseCurrency, heldCurrencies],
    queryFn: async () => {
      const entries = await Promise.all(
        heldCurrencies.map(async (currency) => {
          const resolution = await fxRepo.resolve({ householdId: household!.id, base: currency, quote: household!.baseCurrency, date: todayIso(), liveRecalc: true });
          return [currency, resolution] as const;
        })
      );
      return new Map<string, FxResolution>(entries);
    },
    enabled: !!household && heldCurrencies.length > 0,
  });

  usePageHeader({ title: t("rebalancePage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  const errorState = useQueryErrorState(
    tradesQuery.isError ? tradesQuery : assetClassesQuery.isError ? assetClassesQuery : instrumentsQuery.isError ? instrumentsQuery : targetsQuery,
    { what: t("rebalancePage.loadError") }
  );

  const valuation = useMemo(() => {
    if (!trades || !instruments) return null;
    const positions = computePositions(trades.map((tr) => ({ id: tr.id, instrumentId: tr.instrumentId, kind: tr.kind, quantity: tr.quantity, price: tr.price, netAmount: tr.netAmount, executedAt: tr.executedAt })));
    return valuePositionsInBase({
      positions,
      instrumentById,
      prices,
      baseCurrency: household?.baseCurrency ?? "",
      fxResolutions: fxRatesQuery.data ?? new Map(),
    });
  }, [trades, instruments, instrumentById, prices, household?.baseCurrency, fxRatesQuery.data]);

  // Bucket keys que existen HOY en el portfolio, para la sección de
  // definición — evita necesitar un picker/`<select>` para "agregar una
  // fila": el objetivo se define sobre lo que ya se tiene.
  const heldKeys = useMemo(() => {
    if (!valuation) return [];
    const keys = new Set<string>();
    for (const item of valuation.items) {
      const instrument = instrumentById.get(item.instrumentId);
      if (!instrument) continue;
      if (dimension === "asset_class") keys.add(instrument.assetClassId ?? UNASSIGNED_KEY);
      else if (dimension === "currency") keys.add(instrument.currencyCode);
      else if (dimension === "risk") {
        const ac = instrument.assetClassId ? assetClassById.get(instrument.assetClassId) : undefined;
        keys.add(ac?.defaultRisk ?? UNASSIGNED_KEY);
      }
    }
    // Riesgo tiene un orden natural (bajo → alto) — no alfabético.
    if (dimension === "risk") return [...keys].sort((a, b) => RISK_ORDER.indexOf(a) - RISK_ORDER.indexOf(b));
    return [...keys];
  }, [valuation, instrumentById, assetClassById, dimension]);

  const keyLabel = (key: string): string => {
    if (key === UNASSIGNED_KEY) return t("rebalancePage.unassigned");
    if (dimension === "asset_class") {
      const ac = assetClassById.get(key);
      return ac ? (assetClassLabel(ac) ?? key) : key;
    }
    if (dimension === "risk") return t(`rebalancePage.risk.${key}` as "rebalancePage.risk.low");
    return key; // currency: se muestra con CurrencyChip, no como texto
  };

  if (errorState) return <ErrorState {...errorState} />;

  if (!household || !portfolios || !assetClasses || !instruments) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  if (!portfolio) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <EmptyState message={t("rebalancePage.noPortfolio")} />
      </div>
    );
  }

  if (!trades || !valuation || !targetsQuery.data) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  const rebalance = computeRebalance({
    dimension,
    valuedPositions: valuation.items,
    totalValue: valuation.totalValue,
    excludedCount: valuation.excludedFxCount,
    instrumentById,
    assetClassById,
    targets: targetsQuery.data,
    baseCurrency: household.baseCurrency,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", paddingBottom: 32 }}>
      <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 16 }}>
        {t("rebalancePage.disclaimer")}
      </p>

      <div style={{ marginTop: 16 }}>
        <SegmentedControl
          options={DIMENSIONS.map((d) => ({ id: d, label: t(`rebalancePage.dimension.${d}`) }))}
          value={dimension}
          onChange={(v) => setDimension(v as UiDimension)}
        />
      </div>

      <NeedsFxBanner count={valuation.excludedFxCount} onResolve={() => router.push("/accounts/resolve-fx")} style={{ marginTop: 16 }} />
      {valuation.excludedNoPriceCount > 0 ? (
        <div role="status" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px var(--screen-padding)", background: "color-mix(in srgb, var(--warning) 12%, transparent)", borderRadius: "var(--radius-card)", marginTop: 8, fontSize: 13, color: "var(--text-secondary)" }}>
          <Icon name="alert" size={15} strokeWidth={2} color="var(--warning)" />
          <span>{t("investmentsPage.excludedNoPrice", { count: valuation.excludedNoPriceCount })}</span>
        </div>
      ) : null}

      {/* Ver desvío — solo si hay al menos un target guardado. */}
      {targetsQuery.data.length > 0 ? (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 4 }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("rebalancePage.driftSectionTitle")}</div>
          {rebalance.rows.map((row) => (
            <div key={row.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {dimension === "currency" ? <CurrencyChip currency={row.key} showChevron={false} style={{ height: 24, padding: "0 8px", fontSize: 11 }} /> : (
                    <span className="t-label" style={{ color: "var(--text-primary)" }}>{keyLabel(row.key)}</span>
                  )}
                  {!row.withinBand ? <StatusBadge status="warning">{t("rebalancePage.outOfBand")}</StatusBadge> : null}
                </div>
                <span className="t-caption" style={{ color: "var(--text-muted)" }}>
                  {t("rebalancePage.actualVsTarget", { actual: formatNumber(row.actualPct, 1), target: formatNumber(row.targetPct, 1) })}
                </span>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div className="t-caption" style={{ color: row.withinBand ? "var(--text-muted)" : "var(--warning-text)" }}>
                  {t("rebalancePage.driftPct", { drift: formatNumber(row.driftPct, 1) })}
                </div>
                {row.suggestedAmount !== null ? (
                  <Amount value={money(row.suggestedAmount, household.baseCurrency)} size="label" showSign polarity="neutral" />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message={t("rebalancePage.noTargets")} style={{ marginTop: 24 }} />
      )}

      {/* Definir objetivo — `key` fuerza un remount al cambiar de
          dimensión o de targets guardados, así el borrador arranca de
          cero sin un `useEffect` + `setState` en cascada (mismo criterio
          que `key={id}` en un detalle de master-detail). */}
      <DefineTargetsSection
        key={`${dimension}-${targetsQuery.dataUpdatedAt}`}
        dimension={dimension}
        portfolioId={portfolio.id}
        heldKeys={heldKeys}
        savedTargets={targetsQuery.data}
        keyLabel={keyLabel}
        onSaved={invalidateTargets}
      />
    </div>
  );
}

interface DefineTargetsSectionProps {
  dimension: UiDimension;
  portfolioId: string;
  heldKeys: string[];
  savedTargets: { key: string; targetPct: number; bandPct: number }[];
  keyLabel: (key: string) => string;
  onSaved: () => void;
}

function DefineTargetsSection({ dimension, portfolioId, heldKeys, savedTargets, keyLabel, onSaved }: DefineTargetsSectionProps) {
  const t = useTranslations();
  const savedByKey = useMemo(() => new Map(savedTargets.map((tg) => [tg.key, tg])), [savedTargets]);
  const initialKeys = useMemo(() => [...new Set([...heldKeys, ...savedTargets.map((tg) => tg.key)])], [heldKeys, savedTargets]);
  const [draftRows, setDraftRows] = useState<DraftRow[]>(() =>
    initialKeys.map((key) => ({
      key,
      targetPct: savedByKey.get(key) ? String(savedByKey.get(key)!.targetPct) : "0",
      bandPct: savedByKey.get(key)?.bandPct ?? 5,
    }))
  );
  const [saving, setSaving] = useState(false);

  const draftTotal = draftRows.reduce((sum, row) => sum + (Number(row.targetPct) || 0), 0);
  const draftValid = Math.abs(draftTotal - 100) <= SUM_EPSILON || draftRows.length === 0;

  const handleRemoveRow = (key: string) => setDraftRows((rows) => rows.filter((r) => r.key !== key));

  const handleSave = async () => {
    if (!draftValid || saving) return;
    setSaving(true);
    try {
      await targetAllocationsRepo.upsertMany(
        portfolioId,
        dimension,
        draftRows.filter((r) => Number(r.targetPct) > 0).map((r) => ({ key: r.key, targetPct: Number(r.targetPct), bandPct: r.bandPct }))
      );
      onSaved();
      toast(t("rebalancePage.saved"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("rebalancePage.defineSectionTitle")}</div>
          <span className="t-caption" style={{ color: draftValid ? "var(--text-muted)" : "var(--warning-text)" }}>
            {t("rebalancePage.currentSum", { sum: formatNumber(draftTotal, 1) })}
          </span>
        </div>

        {draftRows.length === 0 ? (
          <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 8 }}>{t("rebalancePage.noHoldingsForDimension")}</p>
        ) : (
          draftRows.map((row) => (
            <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {dimension === "currency" ? <CurrencyChip currency={row.key} showChevron={false} /> : (
                  <span className="t-body" style={{ color: "var(--text-primary)" }}>{keyLabel(row.key)}</span>
                )}
              </div>
              <Input
                value={row.targetPct}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraftRows((rows) => rows.map((r) => (r.key === row.key ? { ...r, targetPct: v } : r)));
                }}
                inputMode="decimal"
                style={{ width: 88 }}
                label={t("rebalancePage.targetPctLabel")}
              />
              <IconButton icon="close" ariaLabel={t("rebalancePage.removeRow")} onClick={() => handleRemoveRow(row.key)} />
            </div>
          ))
        )}
      </div>

      {draftRows.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <Button variant="primary" disabled={!draftValid || saving} onClick={() => void handleSave()}>
            {t("rebalancePage.save")}
          </Button>
          {!draftValid ? <p className="t-caption" style={{ color: "var(--warning-text)", marginTop: 8, textAlign: "center" }}>{t("rebalancePage.sumError", { sum: formatNumber(draftTotal, 1) })}</p> : null}
        </div>
      ) : null}
    </>
  );
}
