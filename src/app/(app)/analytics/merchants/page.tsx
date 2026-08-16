"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, NeedsFxBanner, Skeleton, usePageHeader } from "@/design-system";
import { RankingBar } from "@/design-system/charts";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { usePayees } from "@/hooks/use-payees";
import { useTransactions } from "@/hooks/use-transactions";
import { previousClosedPeriodBounds } from "@/lib/analytics/history";
import { formatAmountCompact } from "@/lib/money/format";
import { money } from "@/lib/money/money";

const TOP_N = 8;

/** H9 — comercios, ranking del último período cerrado por monto. */
export default function MerchantsAnalyticsPage() {
  const t = useTranslations();
  const router = useRouter();
  usePageHeader({ title: t("merchantsAnalyticsPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });
  const { data: household } = useCurrentHousehold();
  const { data: payees } = usePayees(household?.id);
  const { data: transactions } = useTransactions(household?.id);

  const { items, excludedCount } = useMemo(() => {
    if (!household || !payees || !transactions) return { items: [], excludedCount: 0 };
    const { start, end } = previousClosedPeriodBounds(household.periodStartDay || 1, new Date());
    const payeeById = new Map(payees.map((p) => [p.id, p]));
    const byPayee = new Map<string, bigint>();
    let exCount = 0;
    for (const tx of transactions) {
      if (tx.kind !== "expense") continue;
      const occurred = new Date(tx.occurredAt);
      if (occurred < start || occurred >= end) continue;
      if (tx.amountBase === null) {
        exCount += 1;
        continue;
      }
      if (!tx.payeeId) continue;
      byPayee.set(tx.payeeId, (byPayee.get(tx.payeeId) ?? 0n) + tx.amountBase);
    }
    const items = [...byPayee.entries()]
      .sort((a, b) => (b[1] > a[1] ? 1 : -1))
      .slice(0, TOP_N)
      .map(([payeeId, total]) => ({ label: payeeById.get(payeeId)?.name ?? payeeId, value: Number(total), total }));
    return { items, excludedCount: exCount };
  }, [household, payees, transactions]);

  if (!household || !payees || !transactions) return <Skeleton height={260} style={{ marginTop: 16 }} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <NeedsFxBanner
        count={excludedCount}
        onResolve={() => router.push("/accounts/resolve-fx")}
        style={{ margin: "0 calc(-1 * var(--screen-padding))", borderRadius: 0 }}
      />
      <div style={{ paddingTop: 24 }}>
        {items.length === 0 ? (
          <EmptyState message={t("merchantsAnalyticsPage.empty")} />
        ) : (
          <RankingBar
            items={items}
            display={(v) => formatAmountCompact(money(BigInt(Math.round(v)), household.baseCurrency), { showSign: false })}
          />
        )}
      </div>
    </div>
  );
}
