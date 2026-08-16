"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, EmptyState, ErrorState, NeedsFxBanner, Skeleton, StatTile, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useTransactions } from "@/hooks/use-transactions";
import { useNetWorth } from "@/hooks/use-net-worth";
import { useQueryErrorState } from "@/hooks/use-query-error-state";
import { useScopeStore } from "@/stores/scope-store";
import { accountMatchesScope } from "@/lib/scope/match-scope";
import { closedPeriodsCount, daysOfHistory, daysUntilPeriodCloses, monthsOfHistory, previousClosedPeriodBounds } from "@/lib/analytics/history";
import { averageDailyExpense, summarizePeriod } from "@/lib/analytics/period-summary";
import { formatAmountCompact, formatNumber } from "@/lib/money/format";
import { money } from "@/lib/money/money";

const MIN_TRENDS_CALENDAR_DAYS = 30;
const MIN_INFLATION_MULTI_CURRENCY_MONTHS = 2;

/**
 * H1 — analytics home. Mínimos de historial de CLAUDE.md § "Mínimos de
 * historial": lo que no llega a su mínimo muestra cuánto falta, nunca un
 * gráfico pobre. `needs_fx` se declara arriba (conteo, nunca monto — ver
 * `NeedsFxBanner`) y nunca se cuenta como 0 en ningún agregado de acá.
 */
export default function AnalyticsPage() {
  const t = useTranslations();
  usePageHeader({ title: t("nav.analysis") });
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const accountsQuery = useAccounts(household?.id);
  const { data: accountsRaw } = accountsQuery;
  const transactionsQuery = useTransactions(household?.id);
  const { data: transactionsRaw } = transactionsQuery;
  // El switch Personal/Compartido/Todo del header filtra acá — antes se
  // mostraba en esta pantalla (2+ miembros) sin que nada de abajo lo
  // leyera. Mismo patrón que el dashboard: `accounts`/`transactions` ya
  // filtrados reemplazan a los crudos del fetch para todo lo que sigue.
  const scope = useScopeStore((s) => s.scope);
  const accounts = useMemo(() => (accountsRaw ?? []).filter((a) => accountMatchesScope(a.visibility, scope)), [accountsRaw, scope]);
  const scopedAccountIds = useMemo(() => new Set(accounts.map((a) => a.id)), [accounts]);
  const transactions = useMemo(
    () => (transactionsRaw ?? []).filter((tx) => scopedAccountIds.has(tx.accountId) || (tx.counterAccountId && scopedAccountIds.has(tx.counterAccountId))),
    [transactionsRaw, scopedAccountIds]
  );
  const netWorth = useNetWorth(household?.id, household?.baseCurrency, accounts, household?.enabledModules.includes("investments"));
  const errorState = useQueryErrorState(accountsQuery.isError ? accountsQuery : transactionsQuery, { what: t("analyticsPage.errorWhat") });

  if (!household || !accountsRaw || !transactionsRaw) {
    return (
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <Skeleton width={140} height={16} style={{ margin: "0 auto" }} />
        <Skeleton width={220} height={44} style={{ margin: "0 auto" }} />
        <Skeleton width="100%" height={84} />
        <Skeleton width="100%" height={76} />
        <Skeleton width="100%" height={76} />
      </div>
    );
  }

  if (errorState) return <ErrorState {...errorState} />;

  if (transactions.length === 0) {
    return <EmptyState message={t("analyticsPage.empty")} actionLabel={t("analyticsPage.emptyAction")} onAction={() => router.push("/add")} />;
  }

  const now = new Date();
  const firstOccurredAt = transactions.reduce<string | undefined>((min, tx) => (min === undefined || tx.occurredAt < min ? tx.occurredAt : min), undefined);
  const history = daysOfHistory(firstOccurredAt, now);
  const historyMonths = monthsOfHistory(firstOccurredAt, now);
  const closedPeriods = closedPeriodsCount(firstOccurredAt, household.periodStartDay || 1, now);
  const daysUntilClose = daysUntilPeriodCloses(household.periodStartDay || 1, now);

  const needsFxCount = transactions.filter((tx) => tx.kind !== "transfer" && tx.amountBase === null).length;

  const hasClosedPeriod = closedPeriods > 0;
  const { start: prevStart, end: prevEnd } = previousClosedPeriodBounds(household.periodStartDay || 1, now);
  const periodSummary = hasClosedPeriod ? summarizePeriod(transactions, prevStart, prevEnd) : null;

  const last30Start = new Date(now.getTime() - MIN_TRENDS_CALENDAR_DAYS * 24 * 60 * 60 * 1000);
  const last30 = summarizePeriod(transactions, last30Start, now);
  const dailyAvg = averageDailyExpense(last30.expenseTotal, MIN_TRENDS_CALENDAR_DAYS);

  const hasTrendsHistory = history >= MIN_TRENDS_CALENDAR_DAYS;
  const hasCurrencyHistory = historyMonths >= MIN_INFLATION_MULTI_CURRENCY_MONTHS;
  const netWorthHistoryOk = history >= 7;

  const AVAILABLE: { key: string; route: string; title: string; subtitle: string }[] = [];
  if (hasTrendsHistory) AVAILABLE.push({ key: "trends", route: "/analytics/trends", title: t("analyticsPage.cards.trends.title"), subtitle: t("analyticsPage.cards.trends.subtitle") });
  if (hasTrendsHistory) AVAILABLE.push({ key: "calendar", route: "/analytics/calendar", title: t("analyticsPage.cards.calendar.title"), subtitle: t("analyticsPage.cards.calendar.subtitle") });
  if (netWorthHistoryOk) AVAILABLE.push({ key: "netWorth", route: "/analytics/net-worth", title: t("analyticsPage.cards.netWorth.title"), subtitle: t("analyticsPage.cards.netWorth.subtitle") });
  // Proyección de saldo — no depende de historial: es forward-looking sobre
  // lo ya comprometido (recurrentes, cuotas), no una tendencia pasada.
  AVAILABLE.push({ key: "balanceProjection", route: "/analytics/balance-projection", title: t("analyticsPage.cards.balanceProjection.title"), subtitle: t("analyticsPage.cards.balanceProjection.subtitle") });
  if (hasClosedPeriod) {
    AVAILABLE.push({ key: "categories", route: "/analytics/categories", title: t("analyticsPage.cards.categories.title"), subtitle: t("analyticsPage.cards.categories.subtitle") });
    AVAILABLE.push({ key: "merchants", route: "/analytics/merchants", title: t("analyticsPage.cards.merchants.title"), subtitle: t("analyticsPage.cards.merchants.subtitle") });
    AVAILABLE.push({ key: "flow", route: "/analytics/flow", title: t("analyticsPage.cards.flow.title"), subtitle: t("analyticsPage.cards.flow.subtitle") });
    AVAILABLE.push({ key: "insights", route: "/analytics/insights", title: t("analyticsPage.cards.insights.title"), subtitle: t("analyticsPage.cards.insights.subtitle") });
  }
  if (hasCurrencyHistory) {
    AVAILABLE.push({ key: "currencies", route: "/analytics/currencies", title: t("analyticsPage.cards.currencies.title"), subtitle: t("analyticsPage.cards.currencies.subtitle") });
    AVAILABLE.push({ key: "inflation", route: "/analytics/inflation", title: t("analyticsPage.cards.inflation.title"), subtitle: t("analyticsPage.cards.inflation.subtitle") });
  }
  AVAILABLE.push({ key: "weekly", route: "/analytics/weekly", title: t("analyticsPage.cards.weekly.title"), subtitle: t("analyticsPage.cards.weekly.subtitle") });
  AVAILABLE.push({ key: "export", route: "/analytics/export", title: t("analyticsPage.cards.export.title"), subtitle: t("analyticsPage.cards.export.subtitle") });
  if (closedPeriods >= 12) {
    AVAILABLE.push({ key: "wrapped", route: "/analytics/wrapped", title: t("analyticsPage.cards.wrapped.title"), subtitle: t("analyticsPage.cards.wrapped.subtitle") });
  }

  const NOT_YET: { key: string; title: string; note: string }[] = [];
  if (!hasClosedPeriod) {
    NOT_YET.push({ key: "closedPeriodAnalyses", title: t("analyticsPage.gaps.closedPeriodAnalyses"), note: t("analyticsPage.missingClosedPeriod", { days: daysUntilClose }) });
  }
  if (!hasCurrencyHistory) {
    NOT_YET.push({
      key: "currencyAnalyses",
      title: t("analyticsPage.gaps.currencyAnalyses"),
      note: t("analyticsPage.missingMonths", { days: Math.max(0, (MIN_INFLATION_MULTI_CURRENCY_MONTHS - historyMonths) * 30) }),
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 8, paddingBottom: 24 }}>
      {needsFxCount > 0 ? <NeedsFxBanner count={needsFxCount} onResolve={() => router.push("/accounts/resolve-fx")} style={{ margin: "0 calc(-1 * var(--screen-padding))", borderRadius: 0 }} /> : null}

      {/* 60/40, no 50/50: "patrimonio neto" es la cifra que más se estira
          (moneda + miles), "tasa de ahorro"/"gasto diario" son casi
          siempre cortas ("12,3%"). `fit` en las dos igual, por si un monto
          particularmente largo no entra ni con el 60%. */}
      <div style={{ display: "flex", gap: 16 }}>
        <StatTile
          label={t("analyticsPage.netWorth")}
          value={formatAmountCompact(netWorth.data?.netWorth ?? money(0n, household.baseCurrency), { showSign: false })}
          fit
          style={{ flex: 3, minWidth: 0 }}
        />
        {periodSummary ? (
          <StatTile label={t("analyticsPage.savingsRate")} value={periodSummary.savingsRatePct !== null ? `${formatNumber(periodSummary.savingsRatePct, 1)}%` : "—"} fit style={{ flex: 2, minWidth: 0 }} />
        ) : (
          <StatTile label={t("analyticsPage.dailySpend")} value={formatAmountCompact(money(dailyAvg, household.baseCurrency), { showSign: false })} fit style={{ flex: 2, minWidth: 0 }} />
        )}
      </div>

      {!periodSummary ? (
        <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>
          {t("analyticsPage.savingsRatePending", { days: daysUntilClose })}
        </p>
      ) : null}

      {AVAILABLE.length > 0 ? (
        <div>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("analyticsPage.availableNow")}</div>
          {/* `lg:grid-cols-2`: en desktop hay ancho de sobra para dos cards
              por fila en vez de una columna estirada a los 1200px del
              layout — la clase va acá, nunca junto a un `display` inline
              en el mismo elemento (un inline `style` siempre gana). Cada
              `Card` pasa a `flex column + height:100%` y el botón interno
              a `flex:1` para que la fila entera sea clickeable, no solo el
              ancho del texto — con alto parejo de grid, antes solo el
              ancho del botón respondía al click. */}
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ marginTop: 10, gap: 10 }}>
            {AVAILABLE.map((item) => (
              <Card key={item.key} padding={16} style={{ cursor: "pointer", display: "flex" }}>
                <button
                  type="button"
                  onClick={() => router.push(item.route)}
                  style={{ all: "unset", cursor: "pointer", display: "block", flex: 1, minWidth: 0 }}
                >
                  <div style={{ fontSize: 16, color: "var(--text-primary)" }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{item.subtitle}</div>
                </button>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {NOT_YET.length > 0 ? (
        <div>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("analyticsPage.notYet")}</div>
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ marginTop: 10, gap: 10 }}>
            {NOT_YET.map((item) => (
              <Card key={item.key} padding={16}>
                <div style={{ fontSize: 16, color: "var(--text-primary)" }}>{item.title}</div>
                <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 3 }}>{item.note}</div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
