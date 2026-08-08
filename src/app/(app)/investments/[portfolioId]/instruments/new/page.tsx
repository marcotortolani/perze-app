"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, Icon, Input, ListRow, Sheet, Skeleton, usePageHeader, ZMark } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useAssetClasses, useInstruments, useInvalidateInstruments } from "@/hooks/use-investments";
import { useAssetClassLabel } from "@/hooks/use-asset-class-label";
import { instrumentsRepo } from "@/lib/repos/instruments-repo";
import { assetClassLabelKey } from "@/lib/investments/asset-class-labels";
import { useCurrencies } from "@/hooks/use-currencies";
import type { InstrumentSearchResult } from "@/app/api/instruments/search/route";

const FIXED_INCOME_CLASS_NAMES = new Set(["Bonos soberanos", "ONs", "Letras", "Plazo fijo"]);

/**
 * I7 — buscador primero, "crear a mano" (I7b) como opción secundaria: la
 * versión anterior de esta pantalla era solo el formulario manual, que le
 * pedía al usuario inventar símbolo/nombre de memoria en vez de elegir de
 * verdad qué está comprando. `/api/instruments/search` cubre Data912
 * (acciones/CEDEARs/bonos/ONs/letras del mercado argentino — un CEDEAR de
 * AAPL/TSLA usa el mismo ticker que el mercado de origen, así que cubre
 * ese caso sin necesitar una fuente de EE.UU. aparte) y las cryptos
 * conocidas. Lo que ninguna de las dos cubre (FCI, plazo fijo, inmuebles,
 * ETFs internacionales) sigue yendo por el formulario manual — el precio a
 * mano sigue siendo de primera clase para esos, nunca un fallback.
 */
export default function NewInstrumentPage({ params }: { params: Promise<{ portfolioId: string }> }) {
  use(params);
  const t = useTranslations();
  const assetClassLabel = useAssetClassLabel();
  const router = useRouter();
  const userId = useEffectiveUserId();
  const { data: household } = useCurrentHousehold();
  const { data: assetClasses = [] } = useAssetClasses();
  const { data: currencies = [] } = useCurrencies();
  const { data: existingInstruments = [] } = useInstruments(household?.id);
  const invalidateInstruments = useInvalidateInstruments(household?.id);
  usePageHeader({ title: t("investmentsPage.newInstrument"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  const [mode, setMode] = useState<"search" | "manual">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InstrumentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);

  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [assetClassId, setAssetClassId] = useState<string | null>(null);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [sheetOpen, setSheetOpen] = useState<"assetClass" | "currency" | "none">("none");
  const [maturityDate, setMaturityDate] = useState("");
  const [couponRate, setCouponRate] = useState("");
  const [couponFrequency, setCouponFrequency] = useState("2");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== "search" || query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset de resultados stale al cambiar de modo o vaciar la búsqueda, no dispara una cascada
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/instruments/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = (await res.json()) as { results: InstrumentSearchResult[] };
          setResults(data.results);
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [mode, query]);

  if (!household || !userId) return null;

  const selectedAssetClass = assetClasses.find((a) => a.id === assetClassId);
  const isFixedIncome = selectedAssetClass ? FIXED_INCOME_CLASS_NAMES.has(selectedAssetClass.name) : false;
  const canSave = symbol.trim() !== "" && name.trim() !== "" && assetClassId !== null;

  const handlePickResult = async (result: InstrumentSearchResult) => {
    if (picking) return;
    setPicking(result.symbol);
    try {
      // "Ya la tenés" (I7): si el household ya tiene un instrumento con
      // este símbolo y proveedor, se reusa en vez de duplicar el catálogo.
      const existing = existingInstruments.find((i) => i.symbol === result.symbol && i.priceProvider === result.priceProvider);
      if (!existing) {
        const assetClass = assetClasses.find((a) => a.name === result.assetClass);
        await instrumentsRepo.create({
          householdId: household.id,
          symbol: result.symbol,
          name: result.name ?? result.symbol,
          assetClassId: assetClass?.id ?? null,
          currencyCode: result.currencyCode,
          createdBy: userId,
          priceProvider: result.priceProvider,
          providerSymbol: result.providerSymbol,
        });
        invalidateInstruments();
      }
      toast(t("newInstrumentPage.created"));
      router.back();
    } finally {
      setPicking(null);
    }
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await instrumentsRepo.create({
        householdId: household.id,
        symbol: symbol.trim(),
        name: name.trim(),
        assetClassId,
        currencyCode,
        createdBy: userId,
        priceProvider: null,
        providerSymbol: null,
        maturityDate: isFixedIncome && maturityDate ? maturityDate : null,
        couponRate: isFixedIncome && couponRate ? Number(couponRate.replace(",", ".")) : null,
        couponFrequency: isFixedIncome && couponRate ? Number(couponFrequency) : null,
      });
      invalidateInstruments();
      toast(t("newInstrumentPage.created"));
      // `back()`, no `replace`/`push` — se llega acá con push desde la
      // lista de inversiones O como sub-paso desde `trades/new` (crear un
      // instrumento sin salir de cargar una operación); en los dos casos
      // esa pantalla de origen ya está en el historial justo debajo.
      // Antes esto hacía `replace` a una URL fija (`trades/new`), que
      // duplicaba la entrada en el caso "desde la lista" Y, en el
      // sub-paso, siempre mandaba a un `trades/new` VACÍO en vez del que
      // se estaba llenando (limitación aceptada en su momento). `back()`
      // resuelve los dos casos a la vez: vuelve exactamente a la pantalla
      // real de origen, con lo que ya se había cargado ahí.
      router.back();
    } finally {
      setSaving(false);
    }
  };

  if (mode === "search") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div className="grid grid-cols-1 lg:grid-cols-2" style={{ flex: 1, minHeight: 0, gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", paddingTop: 16, gap: 16 }}>
            <Input label={t("newInstrumentPage.search")} placeholder="AAPL, GGAL, BTC…" value={query} onChange={(e) => setQuery(e.target.value.toUpperCase())} autoFocus />

            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflowY: "auto" }}>
              {searching ? (
                <Skeleton height={56} />
              ) : query.trim().length < 2 ? (
                <p className="t-body" style={{ color: "var(--text-secondary)", margin: 0 }}>{t("newInstrumentPage.searchHint")}</p>
              ) : results.length === 0 ? (
                <p className="t-body" style={{ color: "var(--text-secondary)", margin: 0 }}>{t("newInstrumentPage.searchEmpty")}</p>
              ) : (
                results.map((r) => {
                  const alreadyHave = existingInstruments.some((i) => i.symbol === r.symbol && i.priceProvider === r.priceProvider);
                  const resultAssetClassLabel = t(`assetClassLabels.${assetClassLabelKey(r.assetClass) ?? "acciones"}`);
                  const metaParts = [r.name && r.name !== r.symbol ? r.name : null, r.variantOf ? t("newInstrumentPage.variantOf", { symbol: r.variantOf }) : `${resultAssetClassLabel} · ${r.currencyCode}`].filter(Boolean);
                  return (
                    <ListRow
                      key={`${r.priceProvider}-${r.symbol}`}
                      label={r.symbol}
                      meta={metaParts.join(" · ")}
                      variant="navigation"
                      onClick={() => handlePickResult(r)}
                      right={alreadyHave ? <span className="t-caption" style={{ color: "var(--text-muted)" }}>{t("newInstrumentPage.alreadyHave")}</span> : undefined}
                    />
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => setMode("manual")}
              style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--text-secondary)", fontFamily: "var(--font-sans)", fontSize: 13, textAlign: "left" }}
            >
              {t("newInstrumentPage.createManually")}
            </button>
          </div>

          <div className="hidden lg:flex" style={{ alignItems: "center", justifyContent: "center" }}>
            <ZMark variant="flip" animated size={28} gap={8} aria-label={t("app.name")} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* `lg`+: el formulario queda a la izquierda tal cual estaba — la
          columna del grid ya da un ancho parecido a `--content-max-width` —
          y la derecha pasa a llevar el `ZMark` en vez de quedar vacía. */}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ flex: 1, minHeight: 0, gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", paddingTop: 16, gap: 16 }}>
          <button
            type="button"
            onClick={() => setMode("search")}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--text-secondary)", fontFamily: "var(--font-sans)", fontSize: 13, alignSelf: "flex-start" }}
          >
            <Icon name="chevron-left" size={14} /> {t("newInstrumentPage.backToSearch")}
          </button>

          <Input label={t("newInstrumentPage.symbol")} placeholder="AAPL" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
          <Input label={t("newInstrumentPage.name")} placeholder="Apple Inc." value={name} onChange={(e) => setName(e.target.value)} />

          <button type="button" onClick={() => setSheetOpen("assetClass")} style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("newInstrumentPage.assetClass")}</div>
            <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{assetClassLabel(selectedAssetClass) ?? t("newInstrumentPage.chooseAssetClass")}</div>
          </button>

          <button type="button" onClick={() => setSheetOpen("currency")} style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("newInstrumentPage.currency")}</div>
            <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{currencyCode}</div>
          </button>

          {isFixedIncome ? (
            <>
              <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("newInstrumentPage.fixedIncomeSection")}</div>
              <Input label={t("newInstrumentPage.maturityDate")} placeholder="2030-12-31" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
              <Input label={t("newInstrumentPage.couponRate")} placeholder="8,5" value={couponRate} onChange={(e) => setCouponRate(e.target.value)} />
              <Input label={t("newInstrumentPage.couponFrequency")} placeholder="2" value={couponFrequency} onChange={(e) => setCouponFrequency(e.target.value.replace(/\D/g, ""))} />
            </>
          ) : null}

          <Button disabled={!canSave || saving} onClick={handleSave} style={{ marginTop: "auto" }}>
            {t("common.save")}
          </Button>
        </div>

        <div className="hidden lg:flex" style={{ alignItems: "center", justifyContent: "center" }}>
          <ZMark variant="flip" animated size={28} gap={8} aria-label={t("app.name")} />
        </div>
      </div>

      <Sheet open={sheetOpen === "assetClass"} title={t("newInstrumentPage.assetClass")} onClose={() => setSheetOpen("none")}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {assetClasses.map((ac) => (
            <ListRow key={ac.id} label={assetClassLabel(ac) ?? ac.name} onClick={() => { setAssetClassId(ac.id); setSheetOpen("none"); }} />
          ))}
        </div>
      </Sheet>
      <Sheet open={sheetOpen === "currency"} title={t("newInstrumentPage.currency")} onClose={() => setSheetOpen("none")}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {currencies.map((c) => (
            <ListRow key={c.code} label={`${c.code} — ${c.name}`} onClick={() => { setCurrencyCode(c.code); setSheetOpen("none"); }} />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
