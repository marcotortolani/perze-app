"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { EmptyState, FxEditor, Icon, Input, RateRow, Sheet, Skeleton, StatusBadge } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { fxRepo } from "@/lib/repos/fx-repo";
import { parseRate, rateFromInteger, type ScaledRate } from "@/lib/fx/rate";
import { todayIso } from "@/lib/repos/ids";
import type { FxResolution } from "@/lib/fx/resolve";

/**
 * E6 — monedas y tipos de cambio por par. No existe para el perfil SIMPLE
 * (una sola moneda en uso): en ese caso la ruta redirige a `/accounts`.
 */
export default function CurrenciesPage() {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: household } = useCurrentHousehold();
  const { data: accounts = [] } = useAccounts(household?.id);
  const [editingPair, setEditingPair] = useState<string | null>(null);
  const [manualRate, setManualRate] = useState<ScaledRate>(rateFromInteger(1));

  const baseCurrency = household?.baseCurrency ?? "UYU";
  const currencies = useMemo(() => [...new Set(accounts.map((a) => a.currencyCode))].filter((c) => c !== baseCurrency).sort(), [accounts, baseCurrency]);

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

  if (!household) return <Skeleton height={300} />;

  if (currencies.length === 0) {
    return <EmptyState icon="wallet" message={t("currenciesPage.empty")} actionLabel={t("currenciesPage.emptyAction")} onAction={() => router.push("/accounts")} />;
  }

  const editingResolution: FxResolution | undefined = editingPair ? ratesQuery.data?.get(editingPair) : undefined;

  const handleSaveOverride = async () => {
    if (!editingPair) return;
    await fxRepo.setManualOverride(editingPair, baseCurrency, manualRate);
    await queryClient.invalidateQueries({ queryKey: ["fx-rates", household.id, baseCurrency, currencies] });
    setEditingPair(null);
    toast(t("currenciesPage.overrideSaved", { pair: `${editingPair} → ${baseCurrency}` }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 16, paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button type="button" onClick={() => router.push("/accounts")} aria-label={t("currenciesPage.back")} style={{ background: "none", border: 0, padding: 4, margin: -4, cursor: "pointer" }}>
          <Icon name="chevron-left" size={22} color="var(--text-secondary)" />
        </button>
        <button
          type="button"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["fx-rates", household.id, baseCurrency, currencies] })}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: 0, cursor: "pointer", color: "var(--primary-ink)", fontSize: 13 }}
        >
          <Icon name="refresh" size={16} color="var(--primary-ink)" />
          {t("currenciesPage.refresh")}
        </button>
      </div>

      {ratesQuery.isLoading ? (
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
                onClick={() => { setEditingPair(currency); setManualRate(rateFromInteger(1)); }}
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
              onClick={() => { setEditingPair(currency); setManualRate(resolution.rate!); }}
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

      <Sheet open={editingPair !== null} title={editingPair ? `${editingPair} → ${baseCurrency}` : ""} onClose={() => setEditingPair(null)} height={360}>
        {editingResolution ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {editingResolution.rate === null ? (
              <Input
                label={t("currenciesPage.howManyWorth", { base: baseCurrency, quote: editingPair ?? "" })}
                placeholder={t("currenciesPage.ratePlaceholder")}
                onChange={(e) => {
                  const parsed = Number(e.target.value.replace(",", "."));
                  if (!Number.isNaN(parsed) && parsed > 0) setManualRate(parseRate(parsed.toFixed(12)));
                }}
              />
            ) : null}
            <FxEditor
              from={editingPair ?? ""}
              to={baseCurrency}
              rate={manualRate}
              suggested={editingResolution.rate ?? undefined}
              source={editingResolution.source === "manual" ? t("currenciesPage.manualOverride") : (editingResolution.provider ?? t("currenciesPage.noProvider"))}
              stale={editingResolution.isStale}
              onChange={setManualRate}
            />
            <button
              type="button"
              onClick={handleSaveOverride}
              style={{ background: "var(--primary-fill)", color: "var(--primary-on-fill)", border: 0, borderRadius: "var(--radius-button)", height: 56, cursor: "pointer", fontSize: 17, fontWeight: 600 }}
            >
              {t("currenciesPage.saveOverride")}
            </button>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
