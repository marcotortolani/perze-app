"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { AppHeader, NeedsFxBanner, Skeleton, StatTile } from "@/design-system";
import { SeriesLegend } from "@/design-system/charts";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { computeCurrencyExposure } from "@/lib/analytics/currency-exposure";
import { convert } from "@/lib/fx/rate";
import { fxRepo } from "@/lib/repos/fx-repo";
import { formatAmountCompact } from "@/lib/money/format";
import { todayIso } from "@/lib/repos/ids";
import type { Money } from "@/lib/money/money";

/** H6 — exposición por moneda: cuánto patrimonio hay en cada moneda, convertido a la base. */
export default function CurrencyExposurePage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: accounts } = useAccounts(household?.id);
  const baseCurrency = household?.baseCurrency;
  const currencies = [...new Set((accounts ?? []).map((a) => a.currencyCode))].filter((c) => c !== baseCurrency).sort();

  const exposureQuery = useQuery({
    queryKey: ["currency-exposure", household?.id, baseCurrency, currencies],
    queryFn: async () => {
      const date = todayIso();
      const rates = new Map<string, bigint | null>();
      await Promise.all(
        currencies.map(async (currency) => {
          const resolution = await fxRepo.resolve({ householdId: household!.id, base: currency, quote: baseCurrency!, date });
          rates.set(currency, resolution.rate);
        })
      );
      const convertToBase = (amount: Money, toCurrency: string): Money | null => {
        const rate = rates.get(amount.currency);
        if (!rate) return null;
        return convert(amount, toCurrency, rate);
      };
      return computeCurrencyExposure(accounts ?? [], baseCurrency!, convertToBase);
    },
    enabled: !!household && !!accounts && !!baseCurrency,
  });

  if (!household || !accounts || !exposureQuery.data) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  const { rows, totalBase, excludedAccountCount } = exposureQuery.data;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("currencyExposurePage.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <NeedsFxBanner count={excludedAccountCount} onResolve={() => router.push("/currencies")} />
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 20 }}>
        <StatTile label={t("currencyExposurePage.total")} value={formatAmountCompact(totalBase, { showSign: false })} />
        <SeriesLegend
          series={rows.map((row) => ({
            label: `${row.currency}${row.pctOfNetWorth !== null ? ` · ${row.pctOfNetWorth.toFixed(0)}%` : ""}`,
            value: row.baseAmount ? formatAmountCompact(row.baseAmount, { showSign: false }) : formatAmountCompact(row.nativeAmount, { showSign: false }),
          }))}
        />
      </div>
    </div>
  );
}
