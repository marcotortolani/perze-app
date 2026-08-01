"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { EmptyState, FxEditor, GroupCard, Icon, Sheet, Skeleton } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useInvalidateTransactions, useTransactions } from "@/hooks/use-transactions";
import { fxRepo } from "@/lib/repos/fx-repo";
import { resolvePendingFx } from "@/features/movements/resolve-pending-fx";
import { todayIso } from "@/lib/dates/today";
import { rateFromInteger, type ScaledRate } from "@/lib/fx/rate";
import { money } from "@/lib/money/money";
import { formatAmountCompact } from "@/lib/money/format";
import type { TransactionRow } from "@/lib/db/schema";

/** E8 — resolver tipos de cambio faltantes en lote. Sale del estado `needs_fx`. Bloque E, Fase 8. */
export default function ResolveFxPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: transactions = [], isLoading } = useTransactions(household?.id);
  const invalidateTransactions = useInvalidateTransactions(household?.id);
  const [editingCurrency, setEditingCurrency] = useState<string | null>(null);
  const [rate, setRate] = useState<ScaledRate>(rateFromInteger(1));
  const [applying, setApplying] = useState(false);

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
    const resolution = await fxRepo.resolve({ householdId: household.id, base: currency, quote: baseCurrency, date: todayIso() });
    setRate(resolution.rate ?? rateFromInteger(1));
    setEditingCurrency(currency);
  };

  const applyRate = async () => {
    if (!editingCurrency || applying) return;
    setApplying(true);
    try {
      const txs = groups.find(([c]) => c === editingCurrency)?.[1] ?? [];
      await fxRepo.setManualOverride(editingCurrency, baseCurrency, rate);
      await Promise.all(txs.map((t) => resolvePendingFx({ transactionId: t.id, baseCurrency, rate })));
      invalidateTransactions();
      toast(t("accountsPage.resolveFx.resolvedCount", { count: txs.length }));
      setEditingCurrency(null);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 16, paddingBottom: 24 }}>
      <button type="button" onClick={() => router.push("/accounts")} aria-label={t("accountsPage.resolveFx.back")} style={{ alignSelf: "flex-start", background: "none", border: 0, padding: 4, margin: -4, cursor: "pointer" }}>
        <Icon name="chevron-left" size={22} color="var(--text-secondary)" />
      </button>
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

      <Sheet open={editingCurrency !== null} title={editingCurrency ? `${editingCurrency} → ${baseCurrency}` : ""} onClose={() => setEditingCurrency(null)} height={340}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <FxEditor from={editingCurrency ?? ""} to={baseCurrency} rate={rate} onChange={setRate} />
          <button
            type="button"
            onClick={applyRate}
            disabled={applying}
            style={{ background: "var(--primary-fill)", color: "var(--primary-on-fill)", border: 0, borderRadius: "var(--radius-button)", height: 56, cursor: "pointer", fontSize: 17, fontWeight: 600, opacity: applying ? 0.6 : 1 }}
          >
            {t("accountsPage.resolveFx.applyToAll")}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
