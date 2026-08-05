"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, Input, ListRow, SegmentedControl, Sheet, usePageHeader, ZMark } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useAccounts } from "@/hooks/use-accounts";
import { useInstruments, useInvalidateTrades } from "@/hooks/use-investments";
import { tradesRepo, type TradeKind } from "@/lib/repos/trades-repo";
import { fxRepo } from "@/lib/repos/fx-repo";
import { todayIso } from "@/lib/repos/ids";
import { convert } from "@/lib/fx/rate";
import { money } from "@/lib/money/money";

const KINDS: TradeKind[] = ["buy", "sell"];

/** I4-I7 — cargar una operación (compra/venta). Requiere un instrumento ya creado (I7b si hace falta). */
export default function NewTradePage({ params }: { params: Promise<{ portfolioId: string }> }) {
  const { portfolioId } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const userId = useEffectiveUserId();
  const { data: household } = useCurrentHousehold();
  const { data: instruments = [] } = useInstruments(household?.id);
  const { data: accounts = [] } = useAccounts(household?.id);
  const invalidateTrades = useInvalidateTrades(portfolioId);
  usePageHeader({ title: t("investmentsPage.recordTrade"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  const [kind, setKind] = useState<TradeKind>("buy");
  const [instrumentId, setInstrumentId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [sheet, setSheet] = useState<"none" | "instrument" | "account">("none");
  const [saving, setSaving] = useState(false);

  if (!household || !userId) return null;

  const instrument = instruments.find((i) => i.id === instrumentId);
  const account = accounts.find((a) => a.id === accountId);
  const qty = Number(quantity.replace(",", "."));
  const unitPrice = Number(price.replace(",", "."));
  const grossAmount = Number.isFinite(qty) && Number.isFinite(unitPrice) ? Math.round(qty * unitPrice * 100) : 0; // unidades mínimas (2 decimales, moneda fiat típica)
  const canSave = !!instrument && !!account && qty > 0 && unitPrice > 0;

  const handleSave = async () => {
    if (!canSave || !instrument || !account || saving) return;
    setSaving(true);
    try {
      const netAmount = BigInt(kind === "buy" ? grossAmount : -grossAmount);
      let amountBase: bigint | null = null;
      let fxRate: string | null = null;
      let fxSource: "identity" | "api" | "manual" | "inherited" | "pending" = "pending";
      if (instrument.currencyCode === household.baseCurrency) {
        amountBase = netAmount;
        fxSource = "identity";
      } else {
        const resolution = await fxRepo.resolve({ householdId: household.id, base: instrument.currencyCode, quote: household.baseCurrency, date: todayIso() });
        if (resolution.rate) {
          amountBase = convert(money(netAmount, instrument.currencyCode), household.baseCurrency, resolution.rate).amount;
          fxRate = resolution.rate.toString();
          fxSource = resolution.source;
        }
      }

      await tradesRepo.create({
        portfolioId,
        instrumentId: instrument.id,
        createdBy: userId,
        kind,
        executedAt: new Date().toISOString(),
        quantity: qty,
        price: unitPrice,
        currencyCode: instrument.currencyCode,
        grossAmount: BigInt(grossAmount),
        netAmount,
        settlementAccountId: account.id,
        amountBase,
        fxRate,
        fxSource,
      });
      invalidateTrades();
      toast(fxSource === "pending" ? t("newTradePage.savedPendingFx") : t("newTradePage.saved"));
      // `back()`, no `replace`/`push` — la lista ya está en el historial
      // justo debajo. `replace("/investments")` duplicaba esa misma
      // entrada.
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
          <SegmentedControl
            options={KINDS.map((k) => ({ id: k, label: t(k === "buy" ? "newTradePage.buy" : "newTradePage.sell") }))}
            value={kind}
            onChange={(k) => setKind(k as TradeKind)}
          />

          <button type="button" onClick={() => setSheet("instrument")} style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("newTradePage.instrument")}</div>
            <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{instrument ? `${instrument.symbol} — ${instrument.name}` : t("newTradePage.chooseInstrument")}</div>
          </button>

          <button type="button" onClick={() => setSheet("account")} style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("newTradePage.settlementAccount")}</div>
            <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{account ? account.name : t("goalsPage.chooseAccount")}</div>
          </button>

          <Input label={t("newTradePage.quantity")} placeholder="10" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.,]/g, ""))} />
          <Input label={t("newTradePage.unitPrice")} placeholder="150,00" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, ""))} />

          <Button disabled={!canSave || saving} onClick={handleSave} style={{ marginTop: "auto" }}>
            {t("common.save")}
          </Button>
        </div>

        <div className="hidden lg:flex" style={{ alignItems: "center", justifyContent: "center" }}>
          <ZMark variant="flip" animated size={28} gap={8} aria-label={t("app.name")} />
        </div>
      </div>

      <Sheet open={sheet === "instrument"} title={t("newTradePage.instrument")} onClose={() => setSheet("none")}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {instruments.map((i) => (
            <ListRow key={i.id} label={`${i.symbol} — ${i.name}`} meta={i.currencyCode} onClick={() => { setInstrumentId(i.id); setSheet("none"); }} />
          ))}
          <ListRow icon="plus" label={t("investmentsPage.newInstrument")} variant="action" onClick={() => router.push(`/investments/${portfolioId}/instruments/new`)} />
        </div>
      </Sheet>
      <Sheet open={sheet === "account"} title={t("newTradePage.settlementAccount")} onClose={() => setSheet("none")}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {accounts.map((a) => (
            <ListRow key={a.id} label={a.name} meta={a.currencyCode} onClick={() => { setAccountId(a.id); setSheet("none"); }} />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
