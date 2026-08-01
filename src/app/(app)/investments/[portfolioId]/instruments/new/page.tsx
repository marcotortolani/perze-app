"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AppHeader, Button, Input, ListRow, Sheet } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { useAssetClasses, useInvalidateInstruments } from "@/hooks/use-investments";
import { instrumentsRepo } from "@/lib/repos/instruments-repo";
import { CURRENCIES } from "@/lib/reference/countries-currencies";

const FIXED_INCOME_CLASS_NAMES = new Set(["Bonos soberanos", "ONs", "Letras", "Plazo fijo"]);

/** I7b — crear instrumento a mano: el formulario de 4 campos que I7 prometía. */
export default function NewInstrumentPage({ params }: { params: Promise<{ portfolioId: string }> }) {
  const { portfolioId } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const userId = useCurrentUserId();
  const { data: household } = useCurrentHousehold();
  const { data: assetClasses = [] } = useAssetClasses();
  const invalidateInstruments = useInvalidateInstruments(household?.id);

  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [assetClassId, setAssetClassId] = useState<string | null>(null);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [sheetOpen, setSheetOpen] = useState<"assetClass" | "currency" | "none">("none");
  const [maturityDate, setMaturityDate] = useState("");
  const [couponRate, setCouponRate] = useState("");
  const [couponFrequency, setCouponFrequency] = useState("2");
  const [saving, setSaving] = useState(false);

  if (!household) return null;

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
      router.push(`/investments/${portfolioId}/trades/new`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("investmentsPage.newInstrument")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 16, gap: 16 }}>
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
