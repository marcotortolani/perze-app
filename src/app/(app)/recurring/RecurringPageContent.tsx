"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useState } from "react";
import { Amount, Button, Chip, EmptyState, ListRow, NeedsFxBanner, SkeletonRow, StatTile, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useAccounts } from "@/hooks/use-accounts";
import { useRecurringRules } from "@/hooks/use-recurring-rules";
import { useInvalidateTransactions } from "@/hooks/use-transactions";
import { computeMonthlyCommitted, computeUpcomingCharges } from "@/lib/analytics/recurring-schedule";
import { chargeRecurringNow } from "@/lib/recurring/materialize";
import { occurrencesBetween } from "@/lib/recurring/occurrences";
import { relativeDayLabel } from "@/lib/recurring/format-date-label";
import { formatAmountCompact } from "@/lib/money/format";
import { money } from "@/lib/money/money";
import { todayIso } from "@/lib/repos/ids";
import type { Locale } from "@/i18n/formatting";
import { RecurringMonthCalendar } from "./RecurringMonthCalendar";

/**
 * G1 — recurrentes: comprometido por mes, próximos vencimientos y qué
 * está pendiente de cargar. Separado de `page.tsx` — ver el comentario en
 * `budgets/BudgetsPageContent.tsx`.
 *
 * Antes esta pantalla decía "todavía no se cargó este mes" por regla, un
 * texto que no existe en ningún documento de diseño y que además usaba
 * mes calendario en vez del período del household. Se reemplaza por lo
 * que G1 pide: cuándo es el próximo cobro, y — la consecuencia de que
 * ahora el auto-registro es por regla (`recurringPage.autoPost`) — qué
 * reglas con auto-registro apagado están esperando que el usuario las
 * cargue a mano.
 */
export default function RecurringPageContent() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: household } = useCurrentHousehold();
  const userId = useEffectiveUserId();
  const { data: rules } = useRecurringRules(household?.id);
  const { data: accounts = [] } = useAccounts(household?.id);
  const invalidateTransactions = useInvalidateTransactions(household?.id);
  const [chargingId, setChargingId] = useState<string | null>(null);
  const accountFilter = searchParams.get("accountId");
  const currencyFilter = searchParams.get("currency");

  const committedQuery = useQuery({
    queryKey: ["recurring-committed", household?.id, rules?.map((r) => `${r.id}:${r.expectedAmount}:${r.frequency}:${r.currencyCode}`).join(",")],
    queryFn: () => computeMonthlyCommitted(household!, rules!),
    enabled: !!household && !!rules,
  });

  // Subpágina de `/more`: header propio con "volver", registrado vía `usePageHeader`.
  usePageHeader({ title: t("morePage.recurring"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  if (!household || !rules || !userId) {
    return (
      <div className="flex flex-col gap-2 pt-4">
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (rules.length === 0) {
    return <EmptyState message={t("recurringPage.empty")} actionLabel={t("recurringPage.emptyAction")} onAction={() => router.push("/recurring/new")} />;
  }

  const today = todayIso();
  const upcoming = computeUpcomingCharges(rules, new Date(), 30);
  const next = upcoming[0];
  const nextRule = next ? rules.find((r) => r.id === next.ruleId) : undefined;
  const nextAccount = nextRule ? accounts.find((a) => a.id === nextRule.accountId) : undefined;

  // Reglas con auto-registro apagado que tienen una ocurrencia vencida sin
  // cargar — la consecuencia directa de que el switch (decisión del
  // usuario) ya no es "siempre encendido" como asume el diseño.
  const pendingManual = rules
    .filter((r) => !r.autoPost && r.archivedAt === null)
    .map((r) => ({ rule: r, due: occurrencesBetween(r, r.anchorDate, today).filter((d) => d <= today) }))
    .filter((p) => p.due.length > 0);

  const accountsWithRules = accounts.filter((a) => rules.some((r) => r.accountId === a.id));
  const currenciesWithRules = [...new Set(rules.map((r) => r.currencyCode))].sort();
  const filteredRules = rules.filter((r) => (!accountFilter || r.accountId === accountFilter) && (!currencyFilter || r.currencyCode === currencyFilter));

  const setFilter = (key: "accountId" | "currency", value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`/recurring${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const relativeDayText = (dateOnly: string) => {
    const rel = relativeDayLabel(dateOnly, today, locale);
    return rel.kind === "today" ? t("recurringPage.relativeToday") : rel.kind === "tomorrow" ? t("recurringPage.relativeTomorrow") : rel.label;
  };

  const handleChargeNow = async (ruleId: string, occDate: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule || chargingId) return;
    setChargingId(ruleId);
    try {
      await chargeRecurringNow(household, userId, rule, occDate);
      invalidateTransactions();
      toast(t("recurringPage.autoPosted", { name: rule.name }));
    } finally {
      setChargingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 pt-2 pb-6 lg:grid-cols-2">
      <div className="flex flex-col gap-1">
        <StatTile
          label={t("recurringPage.committedPerMonth")}
          value={committedQuery.data ? formatAmountCompact(money(committedQuery.data.total, household.baseCurrency), { showSign: false }) : "—"}
          style={{ marginBottom: 4 }}
        />
        {committedQuery.data ? <NeedsFxBanner count={committedQuery.data.excludedCount} onResolve={() => router.push("/accounts/resolve-fx")} style={{ marginBottom: 8 }} /> : null}

        {next && nextRule ? (
          <p className="t-body mt-1 mb-3 text-text-secondary">
            {t("recurringPage.nextUp", {
              name: nextRule.name,
              when: relativeDayText(next.nextDate.toISOString().slice(0, 10)),
              amount: formatAmountCompact(money(nextRule.expectedAmount, nextRule.currencyCode), { showSign: false }),
              account: nextAccount?.name ?? "",
            })}
          </p>
        ) : null}

        <div className="lg:hidden">
          <ListRow icon="calendar" label={t("recurringPage.viewCalendar")} onClick={() => router.push("/recurring/calendar")} />
        </div>

        {accountsWithRules.length > 1 ? (
          <div className="flex flex-wrap gap-2 py-2">
            <Chip selected={!accountFilter} onClick={() => setFilter("accountId", null)}>
              {t("recurringPage.filterAllAccounts")}
            </Chip>
            {accountsWithRules.map((a) => (
              <Chip key={a.id} selected={accountFilter === a.id} onClick={() => setFilter("accountId", a.id)}>
                {a.name}
              </Chip>
            ))}
          </div>
        ) : null}

        {currenciesWithRules.length > 1 ? (
          <div className="flex flex-wrap gap-2 pb-2">
            <Chip selected={!currencyFilter} onClick={() => setFilter("currency", null)}>
              {t("recurringPage.filterAllCurrencies")}
            </Chip>
            {currenciesWithRules.map((code) => (
              <Chip key={code} selected={currencyFilter === code} onClick={() => setFilter("currency", code)}>
                {code}
              </Chip>
            ))}
          </div>
        ) : null}

        {filteredRules.length === 0 ? <EmptyState message={t("recurringPage.emptyFiltered")} /> : null}

        <div className="t-caption mt-3 mb-1 text-text-muted">{t("recurringPage.next30Days")}</div>
        {filteredRules.map((rule) => {
          const account = accounts.find((a) => a.id === rule.accountId);
          const ruleUpcoming = upcoming.find((u) => u.ruleId === rule.id);
          return (
            <ListRow
              key={rule.id}
              label={rule.name}
              meta={ruleUpcoming ? `${relativeDayText(ruleUpcoming.nextDate.toISOString().slice(0, 10))} · ${account?.name ?? ""}` : t(`recurringPage.frequency.${rule.frequency}`)}
              variant="value"
              onClick={() => router.push(`/recurring/${rule.id}`)}
              value={<Amount value={money(rule.expectedAmount, rule.currencyCode)} size="body" showSign={false} polarity="neutral" tabular />}
            />
          );
        })}

        {pendingManual.length > 0 ? (
          <>
            <div className="t-caption mt-4 mb-1 text-text-muted">{t("recurringPage.pendingCharges")}</div>
            {pendingManual.map(({ rule, due }) => (
              <ListRow
                key={rule.id}
                label={rule.name}
                meta={t("recurringPage.chargeNow")}
                variant="value"
                onClick={() => handleChargeNow(rule.id, due[0]!)}
                value={chargingId === rule.id ? "…" : <Amount value={money(rule.expectedAmount, rule.currencyCode)} size="body" showSign={false} polarity="neutral" tabular />}
              />
            ))}
          </>
        ) : null}

        <Button onClick={() => router.push("/recurring/new")} style={{ marginTop: 16 }}>
          {t("recurringPage.newRule")}
        </Button>
      </div>

      <div className="hidden lg:block">
        <RecurringMonthCalendar />
      </div>
    </div>
  );
}
