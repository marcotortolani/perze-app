"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, Input, ListRow, Sheet, usePageHeader, ZMark } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useAssetClasses, useInvalidateInstruments } from "@/hooks/use-investments";
import { instrumentsRepo } from "@/lib/repos/instruments-repo";
import { CURRENCIES } from "@/lib/reference/countries-currencies";

const FIXED_INCOME_CLASS_NAMES = new Set(["Bonos soberanos", "ONs", "Letras", "Plazo fijo"]);

/** I7b — crear instrumento a mano: el formulario de 4 campos que I7 prometía. */
export default function NewInstrumentPage({ params }: { params: Promise<{ portfolioId: string }> }) {
  // El id de portfolio ya no hace falta acá — el destino post-guardado
  // ahora es `router.back()` (ver `handleSave`), así que no hace falta
  // construir ninguna URL con él. Se sigue llamando `use(params)` porque
  // Next lo exige para el contrato de params async de esta ruta.
  use(params);
  const t = useTranslations();
  const router = useRouter();
  const userId = useEffectiveUserId();
  const { data: household } = useCurrentHousehold();
  const { data: assetClasses = [] } = useAssetClasses();
  const invalidateInstruments = useInvalidateInstruments(household?.id);
  usePageHeader({ title: t("investmentsPage.newInstrument"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [assetClassId, setAssetClassId] = useState<string | null>(null);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [sheetOpen, setSheetOpen] = useState<"assetClass" | "currency" | "none">("none");
  const [maturityDate, setMaturityDate] = useState("");
  const [couponRate, setCouponRate] = useState("");
  const [couponFrequency, setCouponFrequency] = useState("2");
  const [saving, setSaving] = useState(false);

  if (!household || !userId) return null;

  const selectedAssetClass = assetClasses.find((a) => a.id === assetClassId);
  const isFixedIncome = selectedAssetClass ? FIXED_INCOME_CLASS_NAMES.has(selectedAssetClass.name) : false;
  const canSave = symbol.trim() !== "" && name.trim() !== "" && assetClassId !== null;

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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* `lg`+: el formulario queda a la izquierda tal cual estaba — la
          columna del grid ya da un ancho parecido a `--content-max-width` —
          y la derecha pasa a llevar el `ZMark` en vez de quedar vacía. */}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ flex: 1, minHeight: 0, gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", paddingTop: 16, gap: 16 }}>
          <Input label={t("newInstrumentPage.symbol")} placeholder="AAPL" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
          <Input label={t("newInstrumentPage.name")} placeholder="Apple Inc." value={name} onChange={(e) => setName(e.target.value)} />

          <button type="button" onClick={() => setSheetOpen("assetClass")} style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("newInstrumentPage.assetClass")}</div>
            <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{selectedAssetClass?.name ?? t("newInstrumentPage.chooseAssetClass")}</div>
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
            <ListRow key={ac.id} label={ac.name} onClick={() => { setAssetClassId(ac.id); setSheetOpen("none"); }} />
          ))}
        </div>
      </Sheet>
      <Sheet open={sheetOpen === "currency"} title={t("newInstrumentPage.currency")} onClose={() => setSheetOpen("none")}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {CURRENCIES.map((c) => (
            <ListRow key={c.code} label={`${c.code} — ${c.name}`} onClick={() => { setCurrencyCode(c.code); setSheetOpen("none"); }} />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
