"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Button, EmptyState, FxEditor, Icon, IconButton, Input, Keypad, ListRow, RateRow, SegmentedControl, Sheet, Skeleton, StatusBadge, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { fxRepo } from "@/lib/repos/fx-repo";
import { RATE_SCALE, formatRateTrimmed, invertRate, rateFromInteger, roundRateForDisplay, type ScaledRate } from "@/lib/fx/rate";
import { appendKeypadRateDigit, parseKeypadRate, parseTypedRate } from "@/lib/fx/rate-keypad";
import { todayIso } from "@/lib/repos/ids";
import type { FxResolution } from "@/lib/fx/resolve";
import { useCurrencies, useInvalidateCurrencies } from "@/hooks/use-currencies";
import { currenciesRepo } from "@/lib/repos/currencies-repo";
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
  /**
   * Qué dirección se muestra CADA fila de la lista — puramente de vista,
   * no toca lo guardado (que sigue siendo siempre `editingPair →
   * baseCurrency`, canónico). "1 USD = 1525,25 ARS" se lee mejor que
   * "1 ARS = 0,00065 USD" para un par así; antes solo se podía elegir la
   * dirección DENTRO del editor, nunca en la lista.
   */
  const [invertedDisplay, setInvertedDisplay] = useState<Record<string, boolean>>({});
  /**
   * El rate tal cual se está mostrando/editando AHORA — en la dirección que
   * indica `inverted`, no siempre en la canónica (`editingPair → baseCurrency`).
   * Antes se guardaba siempre canónico y se invertía para mostrar cada vez
   * que `inverted` estaba activo; como `invertRate` redondea (casi ningún
   * recíproco termina), invertir dos veces en el mismo round-trip —al
   * guardar y de vuelta al mostrar— componía el error y "1500" volvía como
   * "1499,99999925". Ahora la pantalla nunca reinvierte para mostrar: el
   * único `invertRate` del flujo pasa a `handleSaveOverride`, una sola vez,
   * al convertir a la dirección canónica justo antes de persistir.
   */
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

  // Catálogo real (`currencies`, Patrón C — antes era un catálogo estático
  // de 7 más la cobertura de Frankfurter, hardcodeado y desalineado del
  // catálogo de verdad). Sin la base ni lo que ya está trackeado. El texto
  // libre de abajo, cuando el código tipeado no está acá, ahora ofrece
  // CREARLO en el catálogo real en vez de aceptarlo a ciegas — antes eso
  // parecía funcionar en el momento (el override quedaba en Dexie local)
  // pero rompía en el próximo sync (`fx_rates.base` tiene FK contra
  // `currencies`) o en `/api/fx` (`MONEDA_DESCONOCIDA`).
  const { data: allCurrencies = [] } = useCurrencies();
  const invalidateCurrencies = useInvalidateCurrencies();
  const [newCurrencyName, setNewCurrencyName] = useState("");
  const [newCurrencyKind, setNewCurrencyKind] = useState<"fiat" | "crypto">("crypto");
  const [creatingCurrency, setCreatingCurrency] = useState(false);
  const addableCurrencies = useMemo(() => {
    return allCurrencies
      .filter((c) => c.code !== baseCurrency && !currencies.includes(c.code))
      .map((c) => ({ code: c.code, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allCurrencies, currencies, baseCurrency]);

  const knownCodes = useMemo(() => new Set(allCurrencies.map((c) => c.code)), [allCurrencies]);
  const customCodeValid = CUSTOM_CODE_PATTERN.test(customCode) && customCode !== baseCurrency && !currencies.includes(customCode);
  const customCodeIsNew = customCodeValid && !knownCodes.has(customCode);

  const handleCreateAndPickCurrency = async () => {
    if (!customCodeValid || newCurrencyName.trim().length === 0 || creatingCurrency) return;
    setCreatingCurrency(true);
    try {
      const created = await currenciesRepo.add({
        code: customCode,
        name: newCurrencyName.trim(),
        symbol: customCode,
        decimals: newCurrencyKind === "crypto" ? 8 : 2,
        kind: newCurrencyKind,
      });
      invalidateCurrencies();
      setNewCurrencyName("");
      await handlePickNewCurrency(created.code);
    } catch {
      toast(t("accounts.form.addCurrencyError"));
    } finally {
      setCreatingCurrency(false);
    }
  };

  /** Blue/CCL/tarjeta, con un click — queda guardado por household+par (`fx-repo.ts`, `householdFxPreferences`) hasta que el usuario elija otra. */
  const handleSelectQuoteKind = async (currency: string, quoteKind: string, provider: string) => {
    if (!household) return;
    // El override manual (`fx_overrides`/Dexie `provider: 'manual'`) es
    // SIEMPRE el primer paso de la cadena de resolución — gana incluso
    // sobre una preferencia recién elegida acá, así que un household con
    // un override vigente para este par no podía volver a elegir
    // blue/CCL/etc nunca: `setPreference` guardaba la elección pero
    // `resolveFxRate` ni siquiera llegaba a mirarla. Elegir una variante
    // real acá es una decisión explícita de "quiero esta cotización de
    // mercado, no la que tipeé a mano" — así que limpia el override del
    // par, no solo guarda la preferencia.
    await Promise.all([fxRepo.clearManualOverride(household.id, currency, baseCurrency), fxRepo.setPreference(household.id, `${currency}/${baseCurrency}`, provider, quoteKind)]);
    await queryClient.invalidateQueries({ queryKey: ["fx-rates", household.id, baseCurrency, currencies] });
  };

  const handleRefresh = async () => {
    if (!household || currencies.length === 0 || refreshing) return;
    setRefreshing(true);
    try {
      const results = await Promise.all(
        currencies.map((currency) => fxRepo.resolve({ householdId: household.id, base: currency, quote: baseCurrency, date: todayIso(), forceRefresh: true }))
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["fx-rates", household.id, baseCurrency, currencies] }),
        // Prefijo, no la key exacta: cualquier pantalla que haya pedido
        // `useSuggestedFxRate` para CUALQUIER par (no solo `x → baseCurrency`
        // — un pago de tarjeta pide `origen → tarjeta`, que puede no
        // involucrar la moneda base) queda con un rate cacheado de antes
        // de este refresh. `refetchOnMount`/`refetchOnWindowFocus` están en
        // `false` a propósito en todo el `QueryClient` (`providers.tsx`) —
        // acá es donde ese contrato exige invalidar explícito.
        queryClient.invalidateQueries({ queryKey: ["fx-suggested-rate"] }),
      ]);
      const updated = results.filter((r) => r.source === "api").length;
      toast(updated > 0 ? t("currenciesPage.refreshDone", { count: updated }) : t("currenciesPage.refreshNothingNew"));
    } catch {
      toast(t("currenciesPage.refreshOffline"));
    } finally {
      setRefreshing(false);
    }
  };

  usePageHeader({
    title: t("settingsPage.fxSources"),
    onBack: () => router.push("/accounts"),
    backLabel: t("currenciesPage.back"),
    right: (
      <button
        type="button"
        onClick={handleRefresh}
        disabled={refreshing || currencies.length === 0}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: 0, cursor: refreshing ? "default" : "pointer", color: "var(--primary-ink)", fontSize: 13, opacity: refreshing || currencies.length === 0 ? 0.5 : 1 }}
      >
        <Icon name="refresh" size={16} color="var(--primary-ink)" />
        {refreshing ? t("currenciesPage.refreshing") : t("currenciesPage.refresh")}
      </button>
    ),
  });

  if (!household) return <Skeleton height={300} />;

  const resetEditorState = () => {
    setKeypadDigits(null);
    setAddedResolution(null);
    setInverted(false);
  };

  const openEditor = (currency: string, rate: ScaledRate) => {
    resetEditorState();
    setEditingPair(currency);
    setManualRate(roundRateForDisplay(rate));
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
    if (resolution.rate) setManualRate(roundRateForDisplay(resolution.rate));
  };

  const openKeypad = () => {
    // Arranca el teclado desde el rate actual, sin ceros finales — misma
    // precisión que muestra el número grande de FxEditor. Un corte fijo a
    // 2 decimales dejaba una tasa invertida chica (1 ARS = 0,00064 USD)
    // en "0,00". `manualRate` ya vive en la dirección que se está
    // mostrando (ver la nota en el `useState` de más abajo), así que no
    // hay que invertir para mostrarlo.
    const [wholePart, decPart] = formatRateTrimmed(manualRate).split(".");
    setKeypadDigits(decPart ? `${wholePart}${decimalSeparator}${decPart}` : wholePart!);
  };

  const commitKeypad = () => {
    if (keypadDigits !== null) {
      const parsed = parseKeypadRate(keypadDigits, decimalSeparator);
      if (parsed !== null) setManualRate(roundRateForDisplay(parsed));
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
    // Única inversión del flujo: `manualRate` vive en la dirección que se
    // está mostrando, `fx_rate` se guarda siempre canónico
    // (`editingPair → baseCurrency`).
    const canonicalRate = inverted ? invertRate(manualRate) : manualRate;
    await fxRepo.setManualOverride(household.id, editingPair, baseCurrency, canonicalRate);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["fx-rates", household.id, baseCurrency, currencies] }),
      queryClient.invalidateQueries({ queryKey: ["fx-override-currencies", household.id, baseCurrency] }),
      // Prefijo — ver la nota en `handleRefresh`: cualquier pantalla que ya
      // haya pedido `useSuggestedFxRate` para CUALQUIER par (pagar tarjeta
      // pide `origen → tarjeta`, no necesariamente `x → baseCurrency`)
      // queda con un rate cacheado de antes de este override.
      queryClient.invalidateQueries({ queryKey: ["fx-suggested-rate"] }),
    ]);
    closeEditor();
    toast(t("currenciesPage.overrideSaved", { pair: `${editingPair} → ${baseCurrency}` }));
  };

  const sheetTitle = editingPair ? `${editingPair} → ${baseCurrency}` : addingCurrency ? t("currenciesPage.addCurrencyTitle") : "";

  // Términos de edición, ya resueltos según `inverted` — de acá para abajo
  // todo lee `displayFrom`/`displayTo`/`displayRate`, nunca `editingPair`/
  // `baseCurrency` directo. `manualRate` YA está en la dirección mostrada
  // (ver la nota del `useState`), así que `displayRate` es directo, sin
  // invertir. `editingResolution.rate` en cambio siempre llega canónico
  // desde `resolve()` — ese sí se invierte para mostrar, una sola vez,
  // nunca de vuelta.
  const displayFrom = inverted ? baseCurrency : (editingPair ?? "");
  const displayTo = inverted ? (editingPair ?? "") : baseCurrency;
  const displayRate = manualRate;
  const displaySuggested = editingResolution.rate ? (inverted ? invertRate(editingResolution.rate) : editingResolution.rate) : undefined;

  const directionToggle = editingPair ? (
    <SegmentedControl
      options={[
        { id: "normal", label: `1 ${editingPair} = ${baseCurrency}` },
        { id: "inverted", label: `1 ${baseCurrency} = ${editingPair}` },
      ]}
      value={inverted ? "inverted" : "normal"}
      onChange={(id) => {
        const next = id === "inverted";
        if (next !== inverted) setManualRate(roundRateForDisplay(invertRate(manualRate)));
        setInverted(next);
      }}
      size="sm"
    />
  ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 24 }}>
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
          // Default sin tocar el flip: mostrar la dirección donde 1 unidad
          // de la moneda MÁS FUERTE equivale a varias de la más débil —
          // "1 USD = 1.520 ARS", nunca "1 ARS = 0,00000066 USD". Antes
          // siempre arrancaba `currency → baseCurrency` sin importar cuál
          // de las dos valía más, así que cualquier moneda más débil que
          // la base (el caso común: ARS/UYU contra USD) arrancaba
          // mostrando una fracción minúscula. El botón de flip sigue
          // pisando este default una vez que el usuario lo toca.
          const defaultInverted = resolution.rate !== null && resolution.rate < RATE_SCALE;
          const showInverted = invertedDisplay[currency] ?? defaultInverted;
          const displayRate = roundRateForDisplay(showInverted ? invertRate(resolution.rate) : resolution.rate);
          const displayPair = showInverted ? `${baseCurrency} → ${currency}` : `${currency} → ${baseCurrency}`;
          // Blue/CCL/tarjeta (dólar argentino) o cualquier otro par con más
          // de una fuente el mismo día — se ofrece como chips clickeables
          // en vez de una sola cotización fija. Con 0-1 variante no hay
          // nada que elegir, no se dibuja nada de más.
          const quoteKindOptions = resolution.availableQuoteKinds ?? [];
          const activeQuoteKind = resolution.source === "manual" ? "custom" : resolution.quoteKind;
          return (
            <div key={currency} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                onClick={() => openEditor(currency, resolution.rate!)}
                style={{ display: "block", flex: 1, minWidth: 0, textAlign: "left", background: "none", border: 0, padding: 0, cursor: "pointer" }}
              >
                <RateRow
                  pair={displayPair}
                  source={resolution.source === "manual" ? t("currenciesPage.manualOverride") : resolution.provider ?? t("currenciesPage.noProvider")}
                  ageLabel={resolution.isStale ? t("currenciesPage.asOf", { date: resolution.asOf ?? "" }) : t("currenciesPage.today")}
                  rate={displayRate}
                  stale={resolution.isStale}
                />
              </button>
              <IconButton
                icon="refresh"
                ariaLabel={t("currenciesPage.flipDisplayDirection")}
                onClick={() => setInvertedDisplay((prev) => ({ ...prev, [currency]: !showInverted }))}
                size={36}
                iconSize={16}
              />
            </div>
            {quoteKindOptions.length > 1 ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingLeft: 2 }}>
                {quoteKindOptions.map((q) => {
                  // `quoteKind` es un `string` dinámico (viene de un
                  // proveedor externo, no de un tipo cerrado) — un
                  // `switch` con literales en cada `case` tipa bien contra
                  // `currenciesPage.quoteKinds.*`; lo que un proveedor
                  // invente y no esté acá cae al string crudo, nunca rompe.
                  let label: string = q.quoteKind;
                  switch (q.quoteKind) {
                    case "oficial":
                      label = t("currenciesPage.quoteKinds.oficial");
                      break;
                    case "blue":
                      label = t("currenciesPage.quoteKinds.blue");
                      break;
                    case "mep":
                      label = t("currenciesPage.quoteKinds.mep");
                      break;
                    case "ccl":
                      label = t("currenciesPage.quoteKinds.ccl");
                      break;
                    case "mayorista":
                      label = t("currenciesPage.quoteKinds.mayorista");
                      break;
                    case "cripto":
                      label = t("currenciesPage.quoteKinds.cripto");
                      break;
                    case "tarjeta":
                      label = t("currenciesPage.quoteKinds.tarjeta");
                      break;
                    case "default":
                      label = t("currenciesPage.quoteKinds.default");
                      break;
                  }
                  return (
                    <button
                      key={q.quoteKind}
                      type="button"
                      onClick={() => handleSelectQuoteKind(currency, q.quoteKind, q.provider)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        border: `1px solid ${activeQuoteKind === q.quoteKind ? "var(--text-primary)" : "var(--border)"}`,
                        background: "none",
                        color: activeQuoteKind === q.quoteKind ? "var(--text-primary)" : "var(--text-secondary)",
                        fontSize: 12,
                        fontWeight: activeQuoteKind === q.quoteKind ? 600 : 400,
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            </div>
          );
        })
      )}

      {currencies.length > 0 ? (
        <ListRow icon="plus" label={t("currenciesPage.addCurrency")} variant="action" onClick={() => setAddingCurrency(true)} />
      ) : null}

      <Sheet open={addingCurrency} title={sheetTitle} onClose={closeEditor} height="auto">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <Input
              label={t("currenciesPage.customCodeLabel")}
              placeholder={t("currenciesPage.customCodePlaceholder")}
              value={customCode}
              onChange={(e) => {
                setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10));
                setNewCurrencyName("");
              }}
            />
            {customCodeIsNew ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                <p className="t-label" style={{ margin: 0, color: "var(--text-secondary)" }}>{t("currenciesPage.customCodeNewHint", { code: customCode })}</p>
                <Input label={t("accounts.form.addCurrencyName")} value={newCurrencyName} onChange={(e) => setNewCurrencyName(e.target.value)} placeholder={t("accounts.form.addCurrencyNamePlaceholder")} />
                <SegmentedControl
                  options={[
                    { id: "crypto", label: t("accounts.form.addCurrencyCrypto") },
                    { id: "fiat", label: t("accounts.form.addCurrencyFiat") },
                  ]}
                  value={newCurrencyKind}
                  onChange={(v) => setNewCurrencyKind(v as "fiat" | "crypto")}
                />
                <Button variant="secondary" disabled={newCurrencyName.trim().length === 0 || creatingCurrency} onClick={handleCreateAndPickCurrency}>
                  {t("accounts.form.addCurrencyConfirm")}
                </Button>
              </div>
            ) : (
              <Button variant="secondary" style={{ marginTop: 8 }} disabled={!customCodeValid} onClick={() => handlePickNewCurrency(customCode)}>
                {t("currenciesPage.customCodeAdd", { code: customCode || "…" })}
              </Button>
            )}
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

      <Sheet open={editingPair !== null} title={sheetTitle} onClose={closeEditor} height="auto">
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
              {/* Sin operadores: una tasa no se suma ni se multiplica, y
                  `appendKeypadRateDigit` ya los ignora si llegan — acá
                  directamente no se dibujan. */}
              <Keypad operators={false} onKey={(key) => setKeypadDigits((d) => appendKeypadRateDigit(d ?? "", key, decimalSeparator))} onClear={() => setKeypadDigits("")} />
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
                    const rate = parseTypedRate(e.target.value);
                    if (rate !== null) setManualRate(roundRateForDisplay(rate));
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
                onChange={(next) => setManualRate(next)}
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
