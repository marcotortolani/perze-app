"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Button, EmptyState, FxEditor, GroupCard, Keypad, SegmentedControl, Sheet, Skeleton, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useInvalidateAfterTransactionWrite, useTransactions } from "@/hooks/use-transactions";
import { fxRepo } from "@/lib/repos/fx-repo";
import { resolvePendingFx } from "@/features/movements/resolve-pending-fx";
import { todayIso } from "@/lib/dates/today";
import { formatRateTrimmed, invertRate, rateFromInteger, roundRateForDisplay, type ScaledRate } from "@/lib/fx/rate";
import { appendKeypadRateDigit, parseKeypadRate } from "@/lib/fx/rate-keypad";
import { money } from "@/lib/money/money";
import { formatAmountCompact } from "@/lib/money/format";
import { decimalSeparatorForLocale, type Locale } from "@/i18n/formatting";
import type { FxResolution } from "@/lib/fx/resolve";
import type { TransactionRow } from "@/lib/db/schema";

const PENDING_RESOLUTION: FxResolution = { source: "pending", rate: null, provider: null, quoteKind: null, asOf: null, isStale: false };

/** E8 — resolver tipos de cambio faltantes en lote. Sale del estado `needs_fx`. Bloque E, Fase 8. */
export default function ResolveFxPage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  usePageHeader({ title: t("accountsPage.list.resolvePendingFx"), onBack: () => router.push("/accounts"), backLabel: t("accountsPage.resolveFx.back") });
  const { data: household } = useCurrentHousehold();
  const userId = useEffectiveUserId();
  const { data: transactions = [], isLoading } = useTransactions(household?.id);
  const invalidateTransactions = useInvalidateAfterTransactionWrite(household?.id);
  const [editingCurrency, setEditingCurrency] = useState<string | null>(null);
  const [resolution, setResolution] = useState<FxResolution>(PENDING_RESOLUTION);
  /** `rate` vive siempre en la dirección mostrada (`displayFrom → displayTo`), no en la canónica — mismo contrato que `/currencies`. */
  const [rate, setRate] = useState<ScaledRate>(rateFromInteger(1));
  /** `false` = "1 {editingCurrency} = ? {baseCurrency}" (lo que se guarda). `true` = mismo par, tipeado al revés. */
  const [inverted, setInverted] = useState(false);
  const [applying, setApplying] = useState(false);
  // `FxEditor.onOpenKeypad` no estaba wireado acá — tocar la cifra no hacía
  // nada, la única forma de ajustar el rate era el slider ±5%.
  const [keypadDigits, setKeypadDigits] = useState<string | null>(null);
  const decimalSeparator = decimalSeparatorForLocale(locale);

  const baseCurrency = household?.baseCurrency ?? "UYU";
  const pending = transactions.filter((t) => t.fxRate === null);

  const groups = useMemo(() => {
    const byCurrency = new Map<string, TransactionRow[]>();
    for (const t of pending) {
      const list = byCurrency.get(t.currencyCode) ?? [];
      list.push(t);
      byCurrency.set(t.currencyCode, list);
    }
    return [...byCurrency.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  if (isLoading || !household) return <Skeleton height={300} />;

  if (pending.length === 0) {
    return <EmptyState message={t("accountsPage.resolveFx.empty")} actionLabel={t("accountsPage.resolveFx.emptyAction")} onAction={() => router.push("/accounts")} />;
  }

  const openEditor = async (currency: string) => {
    const nextResolution = await fxRepo.resolve({ householdId: household.id, base: currency, quote: baseCurrency, date: todayIso() });
    setResolution(nextResolution);
    setRate(nextResolution.rate ? roundRateForDisplay(nextResolution.rate) : rateFromInteger(1));
    setInverted(false);
    setEditingCurrency(currency);
  };

  const openKeypad = () => {
    const [wholePart, decPart] = formatRateTrimmed(rate).split(".");
    setKeypadDigits(decPart ? `${wholePart}${decimalSeparator}${decPart}` : wholePart!);
  };

  const commitKeypad = () => {
    if (keypadDigits !== null) {
      const parsed = parseKeypadRate(keypadDigits, decimalSeparator);
      if (parsed !== null) setRate(parsed);
    }
    setKeypadDigits(null);
  };

  const applyRate = async () => {
    if (!editingCurrency || applying) return;
    setApplying(true);
    try {
      // `rate` vive en la dirección mostrada (`displayFrom → displayTo`); lo
      // que se guarda y se propaga a las transacciones pendientes es siempre
      // canónico (`editingCurrency → baseCurrency`), igual que `/currencies`.
      const canonicalRate = inverted ? invertRate(rate) : rate;
      const txs = groups.find(([c]) => c === editingCurrency)?.[1] ?? [];
      await fxRepo.setManualOverride(household.id, editingCurrency, baseCurrency, canonicalRate, "custom", userId ?? undefined);
      await Promise.all(txs.map((t) => resolvePendingFx({ transactionId: t.id, baseCurrency, rate: canonicalRate })));
      invalidateTransactions();
      toast(t("accountsPage.resolveFx.resolvedCount", { count: txs.length }));
      setEditingCurrency(null);
    } finally {
      setApplying(false);
    }
  };

  const displayFrom = inverted ? baseCurrency : (editingCurrency ?? "");
  const displayTo = inverted ? (editingCurrency ?? "") : baseCurrency;
  const displaySuggested = resolution.rate ? (inverted ? invertRate(resolution.rate) : resolution.rate) : undefined;

  const directionToggle = editingCurrency ? (
    <SegmentedControl
      options={[
        { id: "normal", label: `1 ${editingCurrency} = ${baseCurrency}` },
        { id: "inverted", label: `1 ${baseCurrency} = ${editingCurrency}` },
      ]}
      value={inverted ? "inverted" : "normal"}
      onChange={(id) => {
        const next = id === "inverted";
        if (next !== inverted) setRate((current) => roundRateForDisplay(invertRate(current)));
        setInverted(next);
      }}
      size="sm"
    />
  ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 24 }}>
      <p className="t-body" style={{ color: "var(--text-secondary)" }}>
        {t("accountsPage.resolveFx.explanation")}
      </p>

      {groups.map(([currency, txs]) => {
        const total = txs.reduce((s, t) => s + t.amount, 0n);
        return (
          <GroupCard
            key={currency}
            caption={`${currency} → ${baseCurrency}`}
            summary={t("accountsPage.resolveFx.count", { count: txs.length, total: formatAmountCompact(money(total, currency), { showSign: false }) })}
            figure={<span style={{ fontFamily: "var(--font-mono)", fontSize: 20, color: "var(--text-primary)" }}>{t("accountsPage.resolveFx.unresolved")}</span>}
            actionLabel={t("accountsPage.resolveFx.resolve")}
            onAction={() => openEditor(currency)}
          />
        );
      })}

      <Sheet
        open={editingCurrency !== null}
        title={editingCurrency ? `${editingCurrency} → ${baseCurrency}` : ""}
        onClose={() => {
          setEditingCurrency(null);
          setKeypadDigits(null);
        }}
        height="auto"
      >
        {keypadDigits !== null ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {directionToggle}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-hero-size)", lineHeight: "var(--text-hero-line)", fontWeight: 600, marginTop: 4 }}>
                {keypadDigits === "" ? "0" : keypadDigits}
              </div>
            </div>
            {/* Sin operadores: un tipo de cambio no se suma ni se multiplica. */}
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
            <FxEditor
              from={displayFrom}
              to={displayTo}
              rate={rate}
              suggested={displaySuggested}
              source={resolution.source === "manual" ? t("currenciesPage.manualOverride") : (resolution.provider ?? t("currenciesPage.noProvider"))}
              stale={resolution.isStale}
              onChange={setRate}
              onOpenKeypad={openKeypad}
            />
            <Button variant="primary" onClick={applyRate} disabled={applying}>
              {t("accountsPage.resolveFx.applyToAll")}
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
