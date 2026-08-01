"use client";

import { use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppHeader, BarChart, EmptyState, ListRow, Skeleton } from "@/design-system";
import { useAccount } from "@/hooks/use-accounts";
import { useDebtsByAccount } from "@/hooks/use-debts";
import { debtsRepo } from "@/lib/repos/debts-repo";
import { useQuery } from "@tanstack/react-query";
import { computeInstallmentProjection } from "@/lib/analytics/installment-projection";
import { formatAmountCompact } from "@/lib/money/format";
import { formatMonthYear } from "@/i18n/formatting";
import { useLocale } from "next-intl";
import type { Locale } from "@/i18n/formatting";
import { money } from "@/lib/money/money";

const MONTHS_AHEAD = 6;

/** E4.2 — cuotas y proyección: lo ya comprometido en planes de cuotas de esta tarjeta, sin estimar consumo nuevo. */
export default function CardInstallmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { data: account, isLoading: accountLoading } = useAccount(id);
  const { data: debtsForAccount, isLoading: plansLoading } = useDebtsByAccount(id);
  const plans = useMemo(() => (debtsForAccount ?? []).filter((d) => d.kind === "installment_plan"), [debtsForAccount]);

  const scheduleQuery = useQuery({
    queryKey: ["debt-schedules-by-account", id, plans.map((p) => p.id)],
    queryFn: async () => {
      const all = await Promise.all(plans.map((p) => debtsRepo.listSchedule(p.id)));
      return all.flat();
    },
    enabled: !!debtsForAccount,
  });

  const projection = useMemo(() => {
    if (!scheduleQuery.data) return null;
    return computeInstallmentProjection(scheduleQuery.data, new Date(), MONTHS_AHEAD);
  }, [scheduleQuery.data]);

  if (accountLoading || plansLoading || !account || !projection) return <Skeleton height={320} style={{ marginTop: 16 }} />;

  if (projection.plans.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <AppHeader title={t("cardInstallmentsPage.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
        <EmptyState message={t("cardInstallmentsPage.empty")} />
      </div>
    );
  }

  const barData = projection.monthBars.map((bar) => ({
    label: formatMonthYear(locale, new Date(`${bar.month}-01`)).slice(0, 3),
    value: Number(bar.amount),
    display: formatAmountCompact(money(bar.amount, account.currencyCode), { showSign: false }),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("cardInstallmentsPage.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 24, paddingBottom: 24 }}>
        <div>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("cardInstallmentsPage.committed")}</div>
          <div style={{ marginTop: 6, fontFamily: "var(--font-sans)", fontSize: 44, fontWeight: 600, letterSpacing: "-.02em" }}>
            {formatAmountCompact(money(projection.totalCommitted, account.currencyCode), { showSign: false })}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-secondary)" }}>
            {t("cardInstallmentsPage.summary", {
              count: projection.plans.length,
              monthly: formatAmountCompact(money(projection.monthlyTotal, account.currencyCode), { showSign: false }),
              date: projection.lastDueDate ? formatMonthYear(locale, new Date(projection.lastDueDate)) : "—",
            })}
          </div>
        </div>

        <div>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("cardInstallmentsPage.activePlans")}</div>
          {projection.plans.map((plan) => {
            const debt = plans.find((p) => p.id === plan.debtId);
            if (!debt) return null;
            return (
              <ListRow
                key={plan.debtId}
                label={debt.name}
                meta={t("cardInstallmentsPage.installmentMeta", { left: plan.installmentsLeft, total: plan.installmentsTotal, monthly: formatAmountCompact(money(plan.monthlyAmount, account.currencyCode), { showSign: false }) })}
                variant="value"
                value={formatAmountCompact(money(plan.remaining, account.currencyCode), { showSign: false })}
                onClick={() => router.push(`/debts/${plan.debtId}`)}
              />
            );
          })}
        </div>

        <div>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("cardInstallmentsPage.upcomingCycles")}</div>
          <div style={{ marginTop: 12 }}>
            <BarChart data={barData} height={140} color="var(--text-secondary)" labelExtremes />
          </div>
          <p className="t-caption" style={{ color: "var(--text-muted)", marginTop: 16 }}>{t("cardInstallmentsPage.noEstimate")}</p>
        </div>
      </div>
    </div>
  );
}
