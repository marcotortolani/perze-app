"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, NeedsFxBanner, Skeleton, StatTile, usePageHeader } from "@/design-system";

// C15/auditoría — mismo criterio que `analytics/trends/page.tsx`: el
// gráfico se difiere con `next/dynamic` para que su código quede en el
// chunk de esta ruta, no en el compartido de `(app)/layout.tsx`.
const LineChart = dynamic(() => import("@/design-system/charts/LineChart").then((m) => m.LineChart), { ssr: false });

import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useDebts } from "@/hooks/use-debts";
import { useRecurringRules } from "@/hooks/use-recurring-rules";
import { usePortfolios, useTrades, useInstruments } from "@/hooks/use-investments";
import { useQueryErrorState } from "@/hooks/use-query-error-state";
import { debtsRepo } from "@/lib/repos/debts-repo";
import { fxRepo } from "@/lib/repos/fx-repo";
import { todayIso } from "@/lib/repos/ids";
import { convert } from "@/lib/fx/rate";
import { money, type Money } from "@/lib/money/money";
import { computeNetWorth, LIABILITY_ACCOUNT_KINDS } from "@/lib/analytics/balances";
import { occurrencesBetween } from "@/lib/recurring/occurrences";
import { computeFutureIncome, type FixedIncomePosition } from "@/lib/analytics/future-income";
import { computePositions } from "@/lib/analytics/positions";
import { addDaysIso, computeBalanceProjection, DEFAULT_HORIZONS_DAYS, type ProjectedEvent } from "@/lib/analytics/balance-projection";
import { formatAmountCompact } from "@/lib/money/format";
import { formatDateShort, type Locale } from "@/i18n/formatting";

const HORIZON_MAX_DAYS = Math.max(...DEFAULT_HORIZONS_DAYS);

/**
 * Fase 4 auditoría — "cuánto vas a tener disponible": proyecta el saldo
 * líquido consolidado a 30/60/90 días sumando SOLO lo ya comprometido
 * (`docs/plan-analisis-comparativas.md`) — próximas ocurrencias de
 * recurrentes, cuotas de deuda pendientes y renta fija contractual. Nunca
 * una estimación de consumo nuevo (mismo criterio que
 * `installment-projection.ts`).
 *
 * Cuentas de tipo `broker` quedan afuera del saldo base: su valor vive en
 * posiciones de inversión, no en `currentBalance` de la cuenta — sumarlas
 * acá duplicaría (o mezclaría) lo que ya cubre la renta fija.
 *
 * La renta fija solo se suma sobre el PRIMER portfolio del household
 * (`usePortfolios(...)![0]`, igual fallback que `usePortfolioFromParam`
 * sin query param) — un household con más de un portfolio de inversión
 * subestima acá lo que ya cuenta bien en `/investments/future-income`.
 * Documentado como límite conocido de esta primera versión.
 */
export default function BalanceProjectionPage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  usePageHeader({ title: t("balanceProjectionPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  const { data: household } = useCurrentHousehold();
  const investmentsEnabled = household?.enabledModules.includes("investments") ?? false;

  const accountsQuery = useAccounts(household?.id);
  const debtsQuery = useDebts(household?.id);
  const rulesQuery = useRecurringRules(household?.id);
  const portfoliosQuery = usePortfolios(investmentsEnabled ? household?.id : undefined);
  const primaryPortfolio = portfoliosQuery.data?.[0];
  const tradesQuery = useTrades(primaryPortfolio?.id);
  const instrumentsQuery = useInstruments(investmentsEnabled ? household?.id : undefined);

  const { data: accounts } = accountsQuery;
  const { data: debts } = debtsQuery;
  const { data: rules } = rulesQuery;

  const scheduleQuery = useQuery({
    queryKey: ["debt-schedules-household", household?.id, (debts ?? []).map((d) => d.id)],
    queryFn: async () => {
      const all = await Promise.all((debts ?? []).map((d) => debtsRepo.listSchedule(d.id)));
      return all.flat();
    },
    enabled: !!debts,
  });

  const nonBrokerAccounts = useMemo(() => (accounts ?? []).filter((a) => a.kind !== "broker" && a.archivedAt === null), [accounts]);

  const currencies = useMemo(() => {
    if (!household) return [];
    const set = new Set<string>();
    for (const a of nonBrokerAccounts) set.add(a.currencyCode);
    for (const d of debts ?? []) set.add(d.currencyCode);
    for (const r of rules ?? []) set.add(r.currencyCode);
    set.delete(household.baseCurrency);
    return [...set].sort();
  }, [household, nonBrokerAccounts, debts, rules]);

  const ratesQuery = useQuery({
    queryKey: ["balance-projection-fx-rates", household?.id, household?.baseCurrency, currencies],
    queryFn: async () => {
      const date = todayIso();
      const rates = new Map<string, bigint | null>();
      await Promise.all(
        currencies.map(async (currency) => {
          const resolution = await fxRepo.resolve({ householdId: household!.id, base: currency, quote: household!.baseCurrency, date, liveRecalc: true });
          rates.set(currency, resolution.rate);
        })
      );
      return rates;
    },
    enabled: !!household && currencies.length >= 0 && !!accounts,
  });

  const errorState = useQueryErrorState(
    accountsQuery.isError ? accountsQuery : debtsQuery.isError ? debtsQuery : rulesQuery.isError ? rulesQuery : scheduleQuery.isError ? scheduleQuery : ratesQuery,
    { what: t("balanceProjectionPage.loadError") }
  );
  if (errorState) return <ErrorState {...errorState} />;

  if (!household || !accounts || !debts || !rules || !scheduleQuery.data || !ratesQuery.data) {
    return (
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <Skeleton width="100%" height={84} />
        <Skeleton width="100%" height={160} />
      </div>
    );
  }

  if (nonBrokerAccounts.length === 0) {
    return <EmptyState message={t("balanceProjectionPage.empty")} />;
  }

  const baseCurrency = household.baseCurrency;
  const rates = ratesQuery.data;
  const convertToBase = (amount: Money): Money | null => {
    if (amount.currency === baseCurrency) return amount;
    const rate = rates.get(amount.currency);
    if (!rate) return null;
    return convert(amount, baseCurrency, rate);
  };

  let excludedCount = 0;

  // Saldo actual, consolidado — solo cuentas líquidas (no `broker`, cuyo
  // valor vive en posiciones, no en `currentBalance`).
  const netWorth = computeNetWorth({
    accounts: nonBrokerAccounts.map((a) => ({
      id: a.id,
      currentBalance: a.currentBalance,
      currencyCode: a.currencyCode,
      includeInNetWorth: a.includeInNetWorth,
      isLiability: LIABILITY_ACCOUNT_KINDS.has(a.kind),
    })),
    baseCurrency,
    convert: convertToBase,
  });
  excludedCount += netWorth.excludedAccountIds.length;

  const nowIso = todayIso();
  const horizonToIso = addDaysIso(nowIso, HORIZON_MAX_DAYS);
  const events: ProjectedEvent[] = [];

  // 1) Próximas ocurrencias de reglas recurrentes — ingreso o gasto.
  for (const rule of rules) {
    const dates = occurrencesBetween(rule, nowIso, horizonToIso);
    for (const date of dates) {
      const converted = convertToBase(money(rule.expectedAmount, rule.currencyCode));
      if (converted === null) {
        excludedCount += 1;
        continue;
      }
      events.push({
        date,
        label: rule.name,
        amount: rule.kind === "income" ? converted.amount : -converted.amount,
        kind: rule.kind === "income" ? "recurring-income" : "recurring-expense",
      });
    }
  }

  // 2) Cuotas de deuda pendientes — dirección `owe` resta, `owed` suma.
  const debtById = new Map(debts.map((d) => [d.id, d]));
  for (const item of scheduleQuery.data) {
    if (item.paidAt !== null) continue;
    if (item.dueDate < nowIso || item.dueDate > horizonToIso) continue;
    const debt = debtById.get(item.debtId);
    if (!debt) continue;
    const converted = convertToBase(money(item.principalAmount + item.interestAmount, debt.currencyCode));
    if (converted === null) {
      excludedCount += 1;
      continue;
    }
    events.push({
      date: item.dueDate,
      label: debt.name,
      amount: debt.direction === "owe" ? -converted.amount : converted.amount,
      kind: debt.direction === "owe" ? "installment-i-owe" : "installment-owed-to-me",
    });
  }

  // 3) Renta fija contractual del portfolio principal (I11) — solo si el
  // módulo de inversiones está prendido y hay posiciones con cupón.
  if (investmentsEnabled && tradesQuery.data && instrumentsQuery.data) {
    const positions = computePositions(
      tradesQuery.data.map((tr) => ({ id: tr.id, instrumentId: tr.instrumentId, kind: tr.kind, quantity: tr.quantity, price: tr.price, netAmount: tr.netAmount, executedAt: tr.executedAt }))
    );
    const instrumentById = new Map(instrumentsQuery.data.map((i) => [i.id, i]));
    const fixedIncomePositions: FixedIncomePosition[] = [...positions.values()]
      .map((position): FixedIncomePosition | null => {
        const instrument = instrumentById.get(position.instrumentId);
        if (!instrument || !instrument.couponRate || !instrument.couponFrequency) return null;
        return {
          instrumentId: instrument.id,
          symbol: instrument.symbol,
          quantity: position.quantity,
          currencyCode: instrument.currencyCode,
          maturityDate: instrument.maturityDate,
          couponRate: instrument.couponRate,
          couponFrequency: instrument.couponFrequency,
        };
      })
      .filter((p): p is FixedIncomePosition => p !== null);

    const monthsAhead = Math.ceil(HORIZON_MAX_DAYS / 30);
    const futureIncome = computeFutureIncome(fixedIncomePositions, new Date(), monthsAhead);
    for (const event of futureIncome) {
      const converted = convertToBase(money(event.amount, event.currencyCode));
      if (converted === null) {
        excludedCount += 1;
        continue;
      }
      events.push({ date: event.date, label: event.symbol, amount: converted.amount, kind: "fixed-income" });
    }
  }

  const projection = computeBalanceProjection(netWorth.netWorth.amount, events, nowIso);

  const chartData = projection.points.map((p) => ({
    label: formatDateShort(locale, new Date(`${p.date}T12:00:00.000Z`)),
    value: Number(p.balance),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {excludedCount > 0 ? (
        <NeedsFxBanner count={excludedCount} onResolve={() => router.push("/accounts/resolve-fx")} style={{ margin: "0 calc(-1 * var(--screen-padding))", borderRadius: 0 }} />
      ) : null}

      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 20, paddingBottom: 24 }}>
        <StatTile label={t("balanceProjectionPage.current")} value={formatAmountCompact(netWorth.netWorth, { showSign: false })} />

        <div>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>
            {t("balanceProjectionPage.chartTitle")}
          </div>
          <LineChart
            data={chartData}
            height={160}
            formatValue={(v) => formatAmountCompact(money(BigInt(Math.round(v)), baseCurrency), { showSign: false })}
            style={{ marginTop: 10, width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {projection.horizons.map((h) => (
            <StatTile key={h.horizonDays} label={t("balanceProjectionPage.horizon", { days: h.horizonDays })} value={formatAmountCompact(money(h.balance, baseCurrency), { showSign: false })} fit style={{ flex: 1, minWidth: 0 }} />
          ))}
        </div>

        {projection.events.length === 0 ? (
          <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>
            {t("balanceProjectionPage.noCommitments")}
          </p>
        ) : (
          <div>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>
              {t("balanceProjectionPage.breakdown")}
            </div>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column" }}>
              {projection.events.map((event, i) => (
                <div key={`${event.date}-${event.label}-${i}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px" }}>
                  <div>
                    <div style={{ fontSize: 15, color: "var(--text-primary)" }}>{event.label}</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{formatDateShort(locale, new Date(`${event.date}T12:00:00.000Z`))}</div>
                  </div>
                  <div style={{ fontSize: 15, color: "var(--text-primary)" }}>{formatAmountCompact(money(event.amount, baseCurrency), { showSign: true })}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="t-caption" style={{ color: "var(--text-muted)" }}>{t("balanceProjectionPage.noEstimate")}</p>
      </div>
    </div>
  );
}
