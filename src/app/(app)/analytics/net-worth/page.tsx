"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppHeader, Skeleton, Sparkline, StatTile } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useTransactions } from "@/hooks/use-transactions";
import { useNetWorth } from "@/hooks/use-net-worth";
import { formatAmountCompact } from "@/lib/money/format";
import { money } from "@/lib/money/money";

const DAYS = 30;

/**
 * H5 — patrimonio neto: tendencia de los últimos 30 días, construida a
 * partir del cashflow real (ingreso − gasto) día a día — no hay tabla de
 * snapshots históricos de patrimonio todavía, así que es una tendencia
 * genuina (tal como hace el hero de Home), no una serie inventada.
 */
export default function NetWorthAnalyticsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: accounts } = useAccounts(household?.id);
  const { data: transactions } = useTransactions(household?.id);
  const netWorth = useNetWorth(household?.id, household?.baseCurrency, accounts ?? []);

  if (!household || !accounts || !transactions) return <Skeleton height={200} style={{ marginTop: 16 }} />;

  const now = new Date();
  const baseCurrency = household.baseCurrency;
  let running = 0n;
  const trend: number[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    const dayNet = transactions
      .filter((tx) => tx.kind !== "transfer" && tx.amountBase !== null && new Date(tx.occurredAt) >= start && new Date(tx.occurredAt) < end)
      .reduce((s, tx) => s + (tx.kind === "income" ? tx.amountBase! : -tx.amountBase!), 0n);
    running += dayNet;
    trend.push(Number(running));
  }

  const net30 = trend.at(-1)! - trend[0]!;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("netWorthAnalyticsPage.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 20 }}>
        <StatTile label={t("netWorthAnalyticsPage.current")} value={formatAmountCompact(netWorth.data?.netWorth ?? money(0n, baseCurrency), { showSign: false })} />
        <div>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("netWorthAnalyticsPage.last30", { amount: formatAmountCompact(money(BigInt(Math.round(net30)), baseCurrency), { showSign: true }) })}</div>
          <Sparkline values={trend} width={320} height={60} style={{ marginTop: 10, width: "100%" }} />
        </div>
      </div>
    </div>
  );
}
