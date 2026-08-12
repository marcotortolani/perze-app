"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Button, EmptyState, IconButton, Keypad, ListRow, SegmentedControl, Sheet, Skeleton, usePageHeader, ZMark } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useAccounts } from "@/hooks/use-accounts";
import { useInstruments, useInvalidateTrades, useTrades } from "@/hooks/use-investments";
import { useInvalidateTransactions } from "@/hooks/use-transactions";
import { tradesRepo, type TradeKind } from "@/lib/repos/trades-repo";
import { deleteSettlementTransaction, resyncSettlementTransaction } from "@/lib/investments/create-settlement-transaction";
import { tradeMovesCash } from "@/lib/investments/trade-settlement-policy";
import { fxRepo } from "@/lib/repos/fx-repo";
import { todayIso } from "@/lib/repos/ids";
import { convert } from "@/lib/fx/rate";
import { appendKeypadRateDigit } from "@/lib/fx/rate-keypad";
import { money } from "@/lib/money/money";
import { decimalsFor } from "@/lib/money/decimals";
import { isCreditCardAccount, tradeSettlementAccounts } from "@/lib/analytics/card-cycle";
import { decimalSeparatorForLocale, type Locale } from "@/i18n/formatting";

const KINDS = ["buy", "sell", "transfer_in"] as const satisfies readonly TradeKind[];

function parseKeypadDecimal(raw: string, decimalSeparator: string): number | null {
  if (raw === "" || raw === decimalSeparator) return null;
  const normalized = raw.replaceAll(decimalSeparator, ".");
  if (!/^\d*\.?\d*$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toKeypadDigits(n: number, decimalSeparator: string): string {
  if (n === 0) return "";
  return String(n).replace(".", decimalSeparator);
}

/**
 * I4 — editar una operación ya cargada. A diferencia de `trades/new`, el
 * instrumento NO se puede cambiar acá — a qué instrumento pertenece una
 * operación no es algo que se "edite", es "cargar una operación distinta".
 * Solo tipo, cuenta de liquidación, cantidad y precio.
 */
export default function EditTradePage({ params }: { params: Promise<{ portfolioId: string; tradeId: string }> }) {
  const { portfolioId, tradeId } = use(params);
  const t = useTranslations();
  // Ver el comentario equivalente en `trades/new/page.tsx`: `t()` necesita
  // una clave literal, así que se resuelve el label acá, no se guarda la
  // clave-string para llamarla después.
  const KIND_LABEL: Record<(typeof KINDS)[number], string> = {
    buy: t("newTradePage.buy"),
    sell: t("newTradePage.sell"),
    transfer_in: t("newTradePage.transferIn"),
  };
  const locale = useLocale() as Locale;
  const decimalSeparator = decimalSeparatorForLocale(locale);
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const userId = useEffectiveUserId();
  const { data: instruments = [] } = useInstruments(household?.id);
  const { data: accounts = [] } = useAccounts(household?.id);
  const { data: trades } = useTrades(portfolioId);
  const invalidateTrades = useInvalidateTrades(portfolioId);
  const invalidateTransactions = useInvalidateTransactions(household?.id);
  usePageHeader({ title: t("instrumentDetailPage.editTrade"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  const trade = trades?.find((tr) => tr.id === tradeId);

  const [kindOverride, setKindOverride] = useState<TradeKind | null>(null);
  const [accountIdOverride, setAccountIdOverride] = useState<string | null | undefined>(undefined);
  const [quantityOverride, setQuantityOverride] = useState<string | null>(null);
  const [priceOverride, setPriceOverride] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"none" | "account" | "quantity" | "price">("none");
  const [keypadDigits, setKeypadDigits] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!household || !userId || !trades) return <Skeleton height={280} style={{ marginTop: 16 }} />;
  if (!trade) return <EmptyState message={t("instrumentDetailPage.tradeNotFound")} />;

  const instrument = instruments.find((i) => i.id === trade.instrumentId);
  const kind = kindOverride ?? trade.kind;
  const accountId = accountIdOverride === undefined ? trade.settlementAccountId : accountIdOverride;
  const account = accounts.find((a) => a.id === accountId);
  const quantity = quantityOverride ?? String(trade.quantity);
  const price = priceOverride ?? String(trade.price);
  const qty = Number(quantity.replace(",", "."));
  const unitPrice = Number(price.replace(",", "."));
  const grossAmount = Number.isFinite(qty) && Number.isFinite(unitPrice) ? Math.round(qty * unitPrice * 10 ** decimalsFor(trade.currencyCode)) : 0;
  // Igual que en el alta: una posición inicial (`transfer_in`) no
  // necesita cuenta de liquidación.
  const requiresAccount = tradeMovesCash(kind);
  const canSave = (!requiresAccount || (!!account && !isCreditCardAccount(account))) && qty > 0 && unitPrice > 0;

  const openQuantityKeypad = () => {
    setKeypadDigits(toKeypadDigits(qty || 0, decimalSeparator));
    setSheet("quantity");
  };
  const openPriceKeypad = () => {
    setKeypadDigits(toKeypadDigits(unitPrice || 0, decimalSeparator));
    setSheet("price");
  };
  const commitKeypad = () => {
    if (keypadDigits !== null) {
      const parsed = parseKeypadDecimal(keypadDigits, decimalSeparator);
      const raw = parsed !== null ? String(parsed) : "";
      if (sheet === "quantity") setQuantityOverride(raw);
      else if (sheet === "price") setPriceOverride(raw);
    }
    setSheet("none");
    setKeypadDigits(null);
  };
  const cancelKeypad = () => {
    setSheet("none");
    setKeypadDigits(null);
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    if (requiresAccount && !account) return;
    setSaving(true);
    try {
      const netAmount = BigInt(kind === "sell" ? -grossAmount : grossAmount);
      let amountBase: bigint | null = null;
      let fxRate: string | null = null;
      let fxSource: "identity" | "api" | "manual" | "inherited" | "pending" = "pending";
      if (trade.currencyCode === household.baseCurrency) {
        amountBase = netAmount;
        fxSource = "identity";
      } else {
        const resolution = await fxRepo.resolve({ householdId: household.id, base: trade.currencyCode, quote: household.baseCurrency, date: todayIso() });
        if (resolution.rate) {
          amountBase = convert(money(netAmount, trade.currencyCode), household.baseCurrency, resolution.rate).amount;
          fxRate = resolution.rate.toString();
          fxSource = resolution.source;
        }
      }

      await tradesRepo.update(trade.id, {
        kind,
        executedAt: trade.executedAt,
        quantity: qty,
        price: unitPrice,
        currencyCode: trade.currencyCode,
        grossAmount: BigInt(grossAmount),
        netAmount,
        settlementAccountId: account?.id ?? null,
        amountBase,
        fxRate,
        fxSource,
      });

      // Si el kind pasó a no mover caja (p. ej. se corrigió una compra a
      // "posición inicial"), la settlement vieja se borra sin recrearse —
      // dejarla habría sido una transacción fantasma que ya no corresponde
      // a este trade. Si sigue moviendo caja, se descarta y se recrea
      // entera con los valores nuevos, mismo criterio que
      // `recompute_account_balance` (recomputar completo, no parchear).
      if (tradeMovesCash(kind) && account) {
        await resyncSettlementTransaction({
          household,
          userId,
          tradeId: trade.id,
          netAmount,
          instrumentCurrency: trade.currencyCode,
          instrumentSymbol: instrument?.symbol ?? trade.instrumentId,
          accountId: account.id,
          accountCurrency: account.currencyCode,
          accountKind: account.kind,
        });
      } else {
        await deleteSettlementTransaction(trade.id);
      }

      invalidateTrades();
      invalidateTransactions();
      toast(t("instrumentDetailPage.tradeUpdated"));
      // `back()`, no `replace`/`push` — el detalle del instrumento ya está
      // en el historial justo debajo.
      router.back();
    } catch (error) {
      // Antes esto era un try/finally sin catch — un fallo real (RLS,
      // red) dejaba el botón habilitado de nuevo sin explicar qué pasó.
      console.error("[trades/edit] no se pudo guardar la edición", error);
      toast(t("newTradePage.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ flex: 1, minHeight: 0, gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", paddingTop: 16, gap: 16 }}>
          <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius-card)", padding: 14 }}>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("newTradePage.instrument")}</div>
            <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{instrument ? `${instrument.symbol} — ${instrument.name}` : trade.instrumentId}</div>
          </div>

          <SegmentedControl
            options={KINDS.map((k) => ({ id: k, label: KIND_LABEL[k] }))}
            value={kind}
            onChange={(k) => setKindOverride(k as TradeKind)}
          />

          {requiresAccount ? (
            <>
              <button type="button" onClick={() => setSheet("account")} style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}>
                <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("newTradePage.settlementAccount")}</div>
                <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{account ? `${account.name} · ${account.currencyCode}` : t("goalsPage.chooseAccount")}</div>
              </button>
              {account && isCreditCardAccount(account) ? (
                // Trade viejo, de antes de esta regla — se puede seguir editando
                // cantidad/precio, pero hay que elegir otra cuenta para guardar.
                <p className="t-caption" style={{ color: "var(--critical)" }}>{t("newTradePage.creditCardNotAllowed")}</p>
              ) : null}
            </>
          ) : (
            <p className="t-caption" style={{ color: "var(--text-muted)", margin: 0, padding: "0 2px" }}>{t("newTradePage.transferInExplainer")}</p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("newTradePage.quantity")}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
              <IconButton icon="minus" ariaLabel={t("newTradePage.decreaseQuantity")} onClick={() => setQuantityOverride(String(Math.max(0, qty - 1)))} />
              <button
                type="button"
                onClick={openQuantityKeypad}
                style={{ background: "none", border: 0, minWidth: 88, padding: "8px 0", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 28, color: "var(--text-primary)", cursor: "pointer" }}
              >
                {quantity || "0"}
              </button>
              <IconButton icon="plus" ariaLabel={t("newTradePage.increaseQuantity")} onClick={() => setQuantityOverride(String(qty + 1))} />
            </div>
          </div>

          <button
            type="button"
            onClick={openPriceKeypad}
            style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}
          >
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("newTradePage.unitPriceInCurrency", { currency: trade.currencyCode })}</div>
            <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{price || "—"}</div>
          </button>

          <Button disabled={!canSave || saving} onClick={handleSave} style={{ marginTop: "auto" }}>
            {t("common.save")}
          </Button>
        </div>

        <div className="hidden lg:flex" style={{ alignItems: "center", justifyContent: "center" }}>
          <ZMark variant="flip" animated size={28} gap={8} aria-label={t("app.name")} />
        </div>
      </div>

      <Sheet open={sheet === "account"} title={t("newTradePage.settlementAccount")} onClose={() => setSheet("none")}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {tradeSettlementAccounts(accounts, trade.settlementAccountId).map((a) => (
            <ListRow key={a.id} label={a.name} meta={a.currencyCode} onClick={() => { setAccountIdOverride(a.id); setSheet("none"); }} />
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === "quantity" || sheet === "price"} title={sheet === "quantity" ? t("newTradePage.quantity") : t("newTradePage.unitPrice")} onClose={cancelKeypad}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 32, color: "var(--text-primary)" }}>
            {keypadDigits || "0"}
          </div>
          <Keypad
            operators={false}
            onKey={(key) => setKeypadDigits((d) => appendKeypadRateDigit(d ?? "", key, decimalSeparator))}
            onClear={() => setKeypadDigits("")}
          />
          <div style={{ display: "flex", gap: 12 }}>
            <Button variant="secondary" onClick={cancelKeypad} style={{ flex: 1 }}>
              {t("currenciesPage.keypadCancel")}
            </Button>
            <Button variant="primary" onClick={commitKeypad} style={{ flex: 1 }}>
              {t("currenciesPage.keypadDone")}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
