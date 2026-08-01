"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AccountCarousel,
  EmptyState,
  Icon,
  InsightCard,
  OfflineBanner,
  ResultGroup,
  Skeleton,
  SkeletonRow,
  Sparkline,
  StatTile,
  TransactionRow,
} from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import { CountUp } from "@/components/motion";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { useTransactions } from "@/hooks/use-transactions";
import { useNetWorth } from "@/hooks/use-net-worth";
import { usePendingMutations } from "@/lib/offline";
import { usePrivacyStore } from "@/stores/privacy-store";
import { abs, add, compare, money, sum, subtract, toMajorUnitsUnsafe, zero } from "@/lib/money/money";
import type { Money } from "@/lib/money/money";
import { formatAmountCompact } from "@/lib/money/format";
import { ACCOUNT_KIND_MESSAGE_KEY } from "@/lib/reference/account-kind-labels";
import { useCategoryLabel } from "@/hooks/use-category-label";
import type { AccountRow, TransactionRow as TransactionRecord } from "@/lib/db/schema";

function startOfPeriod(now: Date, startDay: number): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), startDay);
  if (now.getDate() < startDay) start.setMonth(start.getMonth() - 1);
  return start;
}

function dayBounds(now: Date, daysAgo: number): [Date, Date] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  return [start, end];
}

/** Home real — Bloque B, Fase 6: hero de patrimonio, cuentas, estado del mes, insight, últimos movimientos. */
export default function HomePage() {
  const router = useRouter();
  const t = useTranslations();
  const categoryLabel = useCategoryLabel();
  const { data: household } = useCurrentHousehold();
  const { data: accounts, isLoading: accountsLoading } = useAccounts(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const { data: transactions, isLoading: txLoading } = useTransactions(household?.id);
  const netWorth = useNetWorth(household?.id, household?.baseCurrency, accounts ?? []);
  const privacy = usePrivacyStore((s) => s.privacyMode);
  const togglePrivacy = usePrivacyStore((s) => s.toggle);
  const pending = usePendingMutations();
  const [insightDismissed, setInsightDismissed] = useState(false);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountById = useMemo(() => new Map((accounts ?? []).map((a: AccountRow) => [a.id, a])), [accounts]);

  if (!household || accountsLoading || txLoading) return <HomeSkeleton />;

  const allAccounts = accounts ?? [];
  const allTransactions = transactions ?? [];

  if (allAccounts.length === 0 || allTransactions.length === 0) {
    return (
      <EmptyState
        icon="wallet"
        message={t("home.empty")}
        actionLabel={t("home.emptyAction")}
        onAction={() => router.push("/add")}
      />
    );
  }

  const baseCurrency = household.baseCurrency;
  const currencies = new Set(allAccounts.map((a) => a.currencyCode));
  const now = new Date();

  // Estado del mes: gasto vs. ingreso del período, en moneda base. Se usa
  // `amountBase` (ya convertido al guardar) — los movimientos `needs_fx`
  // (amountBase null) quedan afuera, nunca se cuentan como si valieran 0.
  const periodStart = startOfPeriod(now, household.periodStartDay || 1).toISOString();
  let expenseThisPeriod = zero(baseCurrency);
  let incomeThisPeriod = zero(baseCurrency);
  const spendByCategory = new Map<string, bigint>();
  for (const tx of allTransactions) {
    if (tx.occurredAt < periodStart || tx.kind === "transfer" || tx.amountBase === null) continue;
    const m = money(tx.amountBase, baseCurrency);
    if (tx.kind === "expense") {
      expenseThisPeriod = add(expenseThisPeriod, m);
      if (tx.categoryId) spendByCategory.set(tx.categoryId, (spendByCategory.get(tx.categoryId) ?? 0n) + tx.amountBase);
    } else if (tx.kind === "income") {
      incomeThisPeriod = add(incomeThisPeriod, m);
    }
  }

  // Sparkline del héroe: flujo neto (ingreso − gasto) acumulado de los
  // últimos 14 días, en base a movimientos reales — no un historial de
  // patrimonio snapshot a snapshot (esa tabla todavía no existe), pero sí
  // una tendencia genuina, no inventada. Todo el cálculo es bigint vía
  // lib/money; `toMajorUnitsUnsafe` solo se usa al final, para el pixel del
  // Sparkline — nunca para el delta que se muestra como plata.
  let runningNet = zero(baseCurrency);
  const heroTrendMoney: Money[] = [];
  for (let i = 13; i >= 0; i--) {
    const [start, end] = dayBounds(now, i);
    const dayTransactions = allTransactions.filter(
      (t) => t.kind !== "transfer" && t.amountBase !== null && t.occurredAt >= start.toISOString() && t.occurredAt < end.toISOString(),
    );
    const dayNet = sum(
      baseCurrency,
      dayTransactions.map((t) => money(t.kind === "income" ? t.amountBase! : -t.amountBase!, baseCurrency)),
    );
    runningNet = add(runningNet, dayNet);
    heroTrendMoney.push(runningNet);
  }
  const heroTrend = heroTrendMoney.map((m) => toMajorUnitsUnsafe(m));
  const last7Net = subtract(heroTrendMoney[13]!, heroTrendMoney[6]!);
  const prev7Net = heroTrendMoney[6]!;
  const deltaPolarity = compare(last7Net, prev7Net) >= 0 ? "positive" : "negative";
  const deltaArrow = compare(last7Net, prev7Net) >= 0 ? "↑" : "↓";

  const needsFxCount = allTransactions.filter((t) => t.fxRate === null).length;
  const topCategoryEntry = [...spendByCategory.entries()].sort((a, b) => (b[1] > a[1] ? 1 : -1))[0];
  const topCategory = topCategoryEntry ? categoryById.get(topCategoryEntry[0]) : undefined;

  const accountSummaries = allAccounts.map((a) => ({
    id: a.id,
    institution: a.name,
    name: t(ACCOUNT_KIND_MESSAGE_KEY[a.kind]),
    balance: money(a.currentBalance, a.currencyCode),
    country: a.countryCode ?? undefined,
  }));
  if (currencies.size > 1) {
    accountSummaries.push({
      id: "__total",
      institution: t("home.convertedTotal"),
      name: t("home.accountsCount", { count: allAccounts.length }),
      balance: netWorth.data?.netWorth ?? zero(baseCurrency),
      country: undefined,
    });
  }

  const recentTransactions = allTransactions.slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, paddingTop: 8 }}>
      {pending && pending > 0 ? <OfflineBanner pending={pending} style={{ margin: "0 calc(-1 * var(--screen-padding))", borderRadius: 0 }} /> : null}

      <section style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="t-caption" style={{ color: "var(--text-muted)", letterSpacing: ".08em", textTransform: "uppercase" }}>
            {t("home.netWorth")}
          </span>
          <button type="button" onClick={togglePrivacy} aria-label={privacy ? t("home.showAmounts") : t("home.hideAmounts")} style={{ background: "none", border: 0, padding: 4, cursor: "pointer" }}>
            <Icon name={privacy ? "eye-off" : "eye"} size={15} color="var(--text-muted)" />
          </button>
        </div>
        {netWorth.data ? (
          <CountUp value={netWorth.data.netWorth.amount} currency={baseCurrency} size="hero-xl" showSign={false} polarity="neutral" tabular privacy={privacy} />
        ) : (
          <Skeleton width={180} height={44} />
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: deltaPolarity === "positive" ? "var(--money-positive)" : "var(--money-negative-emphasis)" }}>
            {deltaArrow} {formatAmountCompact(abs(subtract(last7Net, prev7Net)), { showSign: false })}
          </span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("home.vsLastWeek")}</span>
        </div>
        <Sparkline values={heroTrend} width={140} height={32} color={deltaPolarity === "positive" ? "var(--data-1)" : "var(--money-negative-emphasis)"} />
        {netWorth.data && netWorth.data.excludedAccountIds.length > 0 ? (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {t("home.excludedAccounts", { count: netWorth.data.excludedAccountIds.length })}
          </span>
        ) : null}
      </section>

      <AccountCarousel accounts={accountSummaries} privacy={privacy} onSelect={() => router.push("/accounts")} />

      <section style={{ display: "flex", gap: 24 }}>
        <StatTile label={t("home.spentThisPeriod")} value={<span style={{ fontFamily: "var(--font-mono)" }}>{formatAmountCompact(expenseThisPeriod, { showSign: false })}</span>} style={{ flex: 1 }} />
        <StatTile label={t("home.incomeThisPeriod")} value={<span style={{ fontFamily: "var(--font-mono)" }}>{formatAmountCompact(incomeThisPeriod, { showSign: false })}</span>} style={{ flex: 1 }} />
      </section>

      {!insightDismissed ? (
        needsFxCount > 0 ? (
          <InsightCard
            status="warning"
            icon="alert"
            text={t("home.needsFxInsight", { count: needsFxCount })}
            actionLabel={t("home.seeTransactions")}
            onAction={() => router.push("/transactions")}
            onDismiss={() => setInsightDismissed(true)}
            dismissLabel={t("ds.insightCard.dismiss")}
          />
        ) : topCategory ? (
          <InsightCard
            status="neutral"
            icon={topCategory.icon as IconName}
            text={t.rich("home.topCategoryInsight", { category: categoryLabel(topCategory), b: (chunks) => <strong>{chunks}</strong> })}
            sparkline={<Sparkline values={heroTrend.map((v) => Math.max(v, 0))} width={96} height={24} />}
            onDismiss={() => setInsightDismissed(true)}
            dismissLabel={t("ds.insightCard.dismiss")}
          />
        ) : null
      ) : null}

      <ResultGroup label={t("home.recentTransactions")} onSeeAll={() => router.push("/transactions")} seeAllLabel={t("common.seeAll")}>
        <div>
          {recentTransactions.map((tx: TransactionRecord) => {
            const account = accountById.get(tx.accountId);
            const category = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
            const meta = [account?.name, category ? categoryLabel(category) : (tx.kind === "transfer" ? t("home.transfer") : undefined)].filter(Boolean).join(" · ");
            const polarity = tx.kind === "income" ? "positive" : tx.kind === "transfer" ? "neutral" : "negative";
            const secondary = tx.currencyCode !== baseCurrency && tx.amountBase !== null ? formatAmountCompact(money(tx.amountBase, baseCurrency), { showSign: false }) : undefined;
            return (
              <TransactionRow
                key={tx.id}
                icon={(category?.icon as IconName) ?? (tx.kind === "transfer" ? "refresh" : "cart")}
                merchant={category ? categoryLabel(category) : (tx.kind === "transfer" ? t("home.transfer") : t("home.movement"))}
                meta={meta || undefined}
                value={money(tx.kind === "expense" ? -tx.amount : tx.amount, tx.currencyCode)}
                secondary={secondary}
                polarity={polarity}
                privacy={privacy}
                onClick={() => router.push("/transactions")}
              />
            );
          })}
        </div>
      </ResultGroup>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, paddingTop: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <Skeleton width={120} height={12} />
        <Skeleton width={180} height={44} />
        <Skeleton width={100} height={14} />
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Skeleton width={208} height={92} radius={16} />
        <Skeleton width={208} height={92} radius={16} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  );
}
