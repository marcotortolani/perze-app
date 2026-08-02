"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Button, EmptyState, FxEditor, Icon, IconButton, Input, Keypad, ListRow, RateRow, SegmentedControl, Sheet, Skeleton, StatusBadge } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { fxRepo } from "@/lib/repos/fx-repo";
import { formatRateShort, invertRate, parseRate, rateFromInteger, type ScaledRate } from "@/lib/fx/rate";
import { appendKeypadRateDigit, parseKeypadRate } from "@/lib/fx/rate-keypad";
import { todayIso } from "@/lib/repos/ids";
import type { FxResolution } from "@/lib/fx/resolve";
import { CURRENCIES } from "@/lib/reference/countries-currencies";
import { FRANKFURTER_CURRENCIES } from "@/lib/fx/providers/frankfurter";
import { CURRENCY_SYMBOLS } from "@/lib/money/format";
import { decimalSeparatorForLocale, type Locale } from "@/i18n/formatting";

const PENDING_RESOLUTION: FxResolution = { source: "pending", rate: null, provider: null, quoteKind: null, asOf: null, isStale: false };
const CUSTOM_CODE_PATTERN = /^[A-Z0-9]{2,10}$/;

/**
 * E6 — monedas y tipos de cambio por par. No existe para el perfil SIMPLE
 * (una sola moneda en uso): en ese caso la ruta redirige a `/accounts`.
 */
export default function CurrenciesPage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: household } = useCurrentHousehold();
  const { data: accounts = [] } = useAccounts(household?.id);
  const [editingPair, setEditingPair] = useState<string | null>(null);
  const [manualRate, setManualRate] = useState<ScaledRate>(rateFromInteger(1));
  const [keypadDigits, setKeypadDigits] = useState<string | null>(null);
  const [addingCurrency, setAddingCurrency] = useState(false);
  const [customCode, setCustomCode] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  /** El rate de una moneda recién agregada, resuelto apenas se elige — antes de que entre a `currencies`/`ratesQuery`. */
  const [addedResolution, setAddedResolution] = useState<FxResolution | null>(null);
  /** `false` = "1 {editingPair} = ? {baseCurrency}" (lo que se guarda). `true` = mismo par, tipeado al revés — conveniencia de entrada, se invierte antes de guardar. */
  const [inverted, setInverted] = useState(false);
  const decimalSeparator = decimalSeparatorForLocale(locale);

  const baseCurrency = household?.baseCurrency ?? "UYU";

  const overridesQuery = useQuery({
    queryKey: ["fx-override-currencies", household?.id, baseCurrency],
    queryFn: () => fxRepo.listOverrideCurrencies(household!.id, baseCurrency),
    enabled: !!household,
  });

  const currencies = useMemo(() => {
    const set = new Set([...accounts.map((a) => a.currencyCode), ...(overridesQuery.data ?? [])]);
    set.delete(baseCurrency);
    return [...set].sort();
  }, [accounts, overridesQuery.data, baseCurrency]);

  const ratesQuery = useQuery({
    queryKey: ["fx-rates", household?.id, baseCurrency, currencies],
    queryFn: async () => {
      const entries = await Promise.all(
        currencies.map(async (currency) => {
          const resolution = await fxRepo.resolve({ householdId: household!.id, base: currency, quote: baseCurrency, date: todayIso() });
          return [currency, resolution] as const;
        })
      );
      return new Map(entries);
    },
    enabled: !!household && currencies.length > 0,
  });

  // Catálogo fijo (7) ∪ cobertura real de Frankfurter (30, ver el
  // comentario de `SUPPORTED` en el provider) — deduplicado, sin la base
  // ni lo que ya está trackeado. El texto libre de abajo cubre lo que
  // ninguno de los dos lista (ARS/UYU no están en Frankfurter, crypto en
  // ninguno de los dos).
  const addableCurrencies = useMemo(() => {
    const byCode = new Map<string, string>();
    for (const c of CURRENCIES) byCode.set(c.code, c.name);
    for (const c of FRANKFURTER_CURRENCIES) if (!byCode.has(c.code)) byCode.set(c.code, c.name);
    byCode.delete(baseCurrency);
    for (const code of currencies) byCode.delete(code);
    return [...byCode.entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [currencies, baseCurrency]);

  const customCodeValid = CUSTOM_CODE_PATTERN.test(customCode) && customCode !== baseCurrency && !currencies.includes(customCode);

  if (!household) return <Skeleton height={300} />;

  const resetEditorState = () => {
    setKeypadDigits(null);
    setAddedResolution(null);
    setInverted(false);
  };

  const openEditor = (currency: string, rate: ScaledRate) => {
    resetEditorState();
    setEditingPair(currency);
    setManualRate(rate);
  };

  /** "Agregar una moneda": a diferencia de `openEditor`, esta todavía no está en `currencies`/`ratesQuery` — se resuelve el rate acá mismo para no arrancar siempre en 1:1 cuando sí hay cotización disponible. */
  const handlePickNewCurrency = async (code: string) => {
    setAddingCurrency(false);
    setCustomCode("");
    resetEditorState();
    setEditingPair(code);
    setManualRate(rateFromInteger(1));
    if (!household) return;
    const resolution = await fxRepo.resolve({ householdId: household.id, base: code, quote: baseCurrency, date: todayIso() });
    setAddedResolution(resolution);
    if (resolution.rate) setManualRate(resolution.rate);
  };

  const openKeypad = () => {
    // Arranca el teclado desde el rate actual, a 2 decimales — misma
    // precisión que muestra el número grande de FxEditor. Si está
    // invertido, el número que se ve/tipea es el invertido también.
    const displayed = inverted ? invertRate(manualRate) : manualRate;
    const [wholePart, decPart] = formatRateShort(displayed, 2).split(".");
    setKeypadDigits(`${wholePart}${decimalSeparator}${decPart}`);
  };

  const commitKeypad = () => {
    if (keypadDigits !== null) {
      const parsed = parseKeypadRate(keypadDigits, decimalSeparator);
      if (parsed !== null) setManualRate(inverted ? invertRate(parsed) : parsed);
    }
    setKeypadDigits(null);
  };

  const closeEditor = () => {
    setEditingPair(null);
    setAddingCurrency(false);
    setCustomCode("");
    resetEditorState();
  };

  const editingResolution: FxResolution = editingPair ? (ratesQuery.data?.get(editingPair) ?? addedResolution ?? PENDING_RESOLUTION) : PENDING_RESOLUTION;

  const handleSaveOverride = async () => {
    if (!editingPair) return;
    await fxRepo.setManualOverride(household.id, editingPair, baseCurrency, manualRate);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["fx-rates", household.id, baseCurrency, currencies] }),
      queryClient.invalidateQueries({ queryKey: ["fx-override-currencies", household.id, baseCurrency] }),
    ]);
    closeEditor();
    toast(t("currenciesPage.overrideSaved", { pair: `${editingPair} → ${baseCurrency}` }));
  };

  const handleRefresh = async () => {
    if (currencies.length === 0 || refreshing) return;
    setRefreshing(true);
    try {
      const results = await Promise.all(
        currencies.map((currency) => fxRepo.resolve({ householdId: household.id, base: currency, quote: baseCurrency, date: todayIso(), forceRefresh: true }))
      );
      await queryClient.invalidateQueries({ queryKey: ["fx-rates", household.id, baseCurrency, currencies] });
      const updated = results.filter((r) => r.source === "api").length;
      toast(updated > 0 ? t("currenciesPage.refreshDone", { count: updated }) : t("currenciesPage.refreshNothingNew"));
    } catch {
      toast(t("currenciesPage.refreshOffline"));
    } finally {
      setRefreshing(false);
    }
  };

  const sheetTitle = editingPair ? `${editingPair} → ${baseCurrency}` : addingCurrency ? t("currenciesPage.addCurrencyTitle") : "";

  // Términos de edición, ya resueltos según `inverted` — de acá para abajo
  // todo lee `displayFrom`/`displayTo`/`displayRate`, nunca `editingPair`/
  // `baseCurrency`/`manualRate` directo, así que invertir es un solo lugar.
  const displayFrom = inverted ? baseCurrency : (editingPair ?? "");
  const displayTo = inverted ? (editingPair ?? "") : baseCurrency;
  const displayRate = inverted ? invertRate(manualRate) : manualRate;
  const displaySuggested = editingResolution.rate ? (inverted ? invertRate(editingResolution.rate) : editingResolution.rate) : undefined;

  const directionToggle = editingPair ? (
    <SegmentedControl
      options={[
        { id: "normal", label: `1 ${editingPair} = ${baseCurrency}` },
        { id: "inverted", label: `1 ${baseCurrency} = ${editingPair}` },
      ]}
      value={inverted ? "inverted" : "normal"}
      onChange={(id) => setInverted(id === "inverted")}
      size="sm"
    />
  ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 16, paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <IconButton icon="chevron-left" ariaLabel={t("currenciesPage.back")} onClick={() => router.push("/accounts")} style={{ margin: -11 }} />
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || currencies.length === 0}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: 0, cursor: refreshing ? "default" : "pointer", color: "var(--primary-ink)", fontSize: 13, opacity: refreshing || currencies.length === 0 ? 0.5 : 1 }}
        >
          <Icon name="refresh" size={16} color="var(--primary-ink)" />
          {refreshing ? t("currenciesPage.refreshing") : t("currenciesPage.refresh")}
        </button>
      </div>

      {currencies.length === 0 ? (
        <EmptyState message={t("currenciesPage.empty")} actionLabel={t("currenciesPage.addCurrency")} onAction={() => setAddingCurrency(true)} />
      ) : ratesQuery.isLoading ? (
        <Skeleton height={200} />
      ) : (
        currencies.map((currency) => {
          const resolution = ratesQuery.data?.get(currency);
          if (!resolution) return null;
          if (resolution.rate === null) {
            return (
              <button
                key={currency}
                type="button"
                onClick={() => openEditor(currency, rateFromInteger(1))}
                style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", padding: "11px 0", background: "none", border: 0, cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ fontSize: 15, color: "var(--text-primary)" }}>{currency} → {baseCurrency}</span>
                <StatusBadge status="neutral" icon="clock">{t("currenciesPage.noQuote")}</StatusBadge>
              </button>
            );
          }
          return (
            <button
              key={currency}
              type="button"
              onClick={() => openEditor(currency, resolution.rate!)}
              style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: 0, padding: 0, cursor: "pointer" }}
            >
              <RateRow
                pair={`${currency} → ${baseCurrency}`}
                source={resolution.source === "manual" ? t("currenciesPage.manualOverride") : resolution.provider ?? t("currenciesPage.noProvider")}
                ageLabel={resolution.isStale ? t("currenciesPage.asOf", { date: resolution.asOf ?? "" }) : t("currenciesPage.today")}
                rate={resolution.rate}
                stale={resolution.isStale}
              />
            </button>
          );
        })
      )}

      {currencies.length > 0 ? (
        <ListRow icon="plus" label={t("currenciesPage.addCurrency")} variant="action" onClick={() => setAddingCurrency(true)} />
      ) : null}

      <Sheet open={addingCurrency} title={sheetTitle} onClose={closeEditor} height={520}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <Input
              label={t("currenciesPage.customCodeLabel")}
              placeholder={t("currenciesPage.customCodePlaceholder")}
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
            />
            <Button variant="secondary" style={{ marginTop: 8 }} disabled={!customCodeValid} onClick={() => handlePickNewCurrency(customCode)}>
              {t("currenciesPage.customCodeAdd", { code: customCode || "…" })}
            </Button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", overflowY: "auto", maxHeight: 300 }}>
            {addableCurrencies.length === 0 ? (
              <p className="t-body" style={{ color: "var(--text-secondary)", margin: 0 }}>{t("currenciesPage.addCurrencyEmpty")}</p>
            ) : (
              addableCurrencies.map((c) => (
                <ListRow key={c.code} label={c.name} meta={c.code} variant="navigation" onClick={() => handlePickNewCurrency(c.code)} />
              ))
            )}
          </div>
        </div>
      </Sheet>

      <Sheet open={editingPair !== null} title={sheetTitle} onClose={closeEditor} height={keypadDigits !== null ? 520 : 420}>
        {editingPair ? (
          keypadDigits !== null ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {directionToggle}
              <div style={{ textAlign: "center" }}>
                <span className="t-caption" style={{ color: "var(--text-muted)" }}>
                  {t("currenciesPage.howManyWorth", { base: displayTo, quote: displayFrom })}
                </span>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-hero-size)", lineHeight: "var(--text-hero-line)", fontWeight: 600, marginTop: 4 }}>
                  {CURRENCY_SYMBOLS[displayTo] ?? displayTo}{" "}
                  {keypadDigits === "" ? "0" : keypadDigits}
                </div>
              </div>
              <Keypad onKey={(key) => setKeypadDigits((d) => appendKeypadRateDigit(d ?? "", key, decimalSeparator))} onClear={() => setKeypadDigits("")} />
              <div style={{ display: "flex", gap: 12 }}>
                <Button variant="secondary" onClick={() => setKeypadDigits(null)}>
                  {t("currenciesPage.keypadCancel")}
                </Button>
                <Button variant="primary" onClick={commitKeypad} disabled={parseKeypadRate(keypadDigits, decimalSeparator) === null}>
                  {t("currenciesPage.keypadDone")}
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {directionToggle}
              {editingResolution.rate === null ? (
                <Input
                  label={t("currenciesPage.howManyWorth", { base: displayTo, quote: displayFrom })}
                  placeholder={t("currenciesPage.ratePlaceholder")}
                  onChange={(e) => {
                    const parsed = Number(e.target.value.replace(",", "."));
                    if (!Number.isNaN(parsed) && parsed > 0) {
                      const rate = parseRate(parsed.toFixed(12));
                      setManualRate(inverted ? invertRate(rate) : rate);
                    }
                  }}
                />
              ) : null}
              <FxEditor
                from={displayFrom}
                to={displayTo}
                rate={displayRate}
                suggested={displaySuggested}
                source={editingResolution.source === "manual" ? t("currenciesPage.manualOverride") : (editingResolution.provider ?? t("currenciesPage.noProvider"))}
                stale={editingResolution.isStale}
                onChange={(next) => setManualRate(inverted ? invertRate(next) : next)}
                onOpenKeypad={openKeypad}
              />
              <Button variant="primary" onClick={handleSaveOverride}>
                {t("currenciesPage.saveOverride")}
              </Button>
            </div>
          )
        ) : null}
      </Sheet>
    </div>
  );
}
