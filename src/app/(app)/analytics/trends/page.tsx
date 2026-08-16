"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { NeedsFxBanner, Skeleton, StatTile, usePageHeader } from "@/design-system";

// C15/auditoría: importar `BarChart` directo de su archivo (no del barrel
// `@/design-system`, que re-exporta los 13 componentes de charts juntos)
// y diferirlo con `next/dynamic` — así su código queda en un chunk propio
// de esta ruta, no en el chunk compartido de `(app)/layout.tsx`.
const BarChart = dynamic(() => import("@/design-system/charts/BarChart").then((m) => m.BarChart), { ssr: false });
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useTransactions } from "@/hooks/use-transactions";
import { formatAmountCompact, formatNumber } from "@/lib/money/format";
import { money } from "@/lib/money/money";
import { formatDateShort, type Locale } from "@/i18n/formatting";

const DAYS = 14;

/** H3 — tendencias: gasto diario de las últimas 2 semanas, día por día. */
export default function TrendsPage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  usePageHeader({ title: t("trendsPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });
  const { data: household } = useCurrentHousehold();
  const { data: transactions } = useTransactions(household?.id);

  if (!household || !transactions) return <Skeleton height={260} style={{ marginTop: 16 }} />;

  const now = new Date();
  const baseCurrency = household.baseCurrency;
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DAYS - 1)).toISOString().slice(0, 10);
  const windowExpenses = transactions.filter((tx) => tx.kind === "expense" && tx.occurredAt.slice(0, 10) >= cutoff);
  const excludedCount = windowExpenses.filter((tx) => tx.amountBase === null).length;
  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DAYS - 1 - i));
    const iso = d.toISOString().slice(0, 10);
    const total = windowExpenses
      .filter((tx) => tx.amountBase !== null && tx.occurredAt.slice(0, 10) === iso)
      .reduce((s, tx) => s + tx.amountBase!, 0n);
    return { date: d, total };
  });

  const thisWeek = days.slice(-7).reduce((s, d) => s + d.total, 0n);
  const lastWeek = days.slice(0, 7).reduce((s, d) => s + d.total, 0n);
  const deltaPct = lastWeek > 0n ? ((Number(thisWeek) - Number(lastWeek)) / Number(lastWeek)) * 100 : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <NeedsFxBanner
        count={excludedCount}
        onResolve={() => router.push("/accounts/resolve-fx")}
        style={{ margin: "0 calc(-1 * var(--screen-padding))", borderRadius: 0 }}
      />
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 20 }}>
        <StatTile
          label={t("trendsPage.thisWeek")}
          value={formatAmountCompact(money(thisWeek, baseCurrency), { showSign: false })}
          delta={deltaPct !== null ? `${deltaPct >= 0 ? "↑" : "↓"} ${formatNumber(Math.abs(deltaPct), 1)}%` : undefined}
          deltaPolarity={deltaPct === null ? "neutral" : deltaPct > 0 ? "negative" : "positive"}
          deltaNote={t("trendsPage.vsLastWeek")}
        />
        <BarChart
          data={days.map((d) => ({ label: formatDateShort(locale, d.date).slice(0, 2), value: Number(d.total) }))}
          height={140}
        />
      </div>
    </div>
  );
}
