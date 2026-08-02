"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Amount, AppHeader, Button, EmptyState, ProgressBar, Skeleton } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useGoals, useInvalidateGoals } from "@/hooks/use-goals";
import { useAccounts } from "@/hooks/use-accounts";
import { useTransactions } from "@/hooks/use-transactions";
import { goalsRepo } from "@/lib/repos/goals-repo";
import { computeContributionRate, projectArrivalDate } from "@/lib/analytics/goal-projection";
import { formatDateShort } from "@/i18n/formatting";
import type { Locale } from "@/i18n/formatting";
import { money } from "@/lib/money/money";

const CONTRIBUTION_WINDOW_MONTHS = 6;

/** F6 — detalle de una meta: progreso contra el objetivo, respaldado por el saldo real de la cuenta. */
export default function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: goals } = useGoals(household?.id);
  const { data: accounts } = useAccounts(household?.id);
  const { data: transactions } = useTransactions(household?.id);
  const invalidateGoals = useInvalidateGoals(household?.id);

  if (!household || !goals || !accounts || !transactions) return <Skeleton height={260} style={{ marginTop: 16 }} />;

  const goal = goals.find((g) => g.id === id);
  if (!goal) return <EmptyState message={t("goalsPage.notFound")} actionLabel={t("goalsPage.back")} onAction={() => router.push("/goals")} />;

  const account = goal.accountId ? accounts.find((a) => a.id === goal.accountId) : undefined;
  const saved = account ? account.currentBalance : 0n;
  const progress = goal.targetAmount > 0n ? Math.min(1, Number(saved) / Number(goal.targetAmount)) : 0;
  const remaining = goal.targetAmount - saved;

  const monthlyRate = account ? computeContributionRate(transactions, account.id, new Date(), CONTRIBUTION_WINDOW_MONTHS) : 0n;
  const arrivalDate = account ? projectArrivalDate(saved, goal.targetAmount, monthlyRate, new Date()) : null;

  const handleDelete = async () => {
    await goalsRepo.archive(goal.id);
    invalidateGoals();
    toast(t("goalsPage.deleted"));
    router.push("/goals");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={goal.name} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ paddingTop: 24, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ textAlign: "center" }}>
          <Amount value={money(saved, goal.currencyCode)} size="hero" fit showSign={false} polarity="neutral" tabular />
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            {t("goalsPage.of")} <Amount value={money(goal.targetAmount, goal.currencyCode)} size="label" showSign={false} polarity="neutral" tabular />
          </div>
        </div>
        <ProgressBar value={progress} height={10} />
        {remaining > 0n ? (
          <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)", textAlign: "center" }}>
            {t("goalsPage.remainingToTarget")} <Amount value={money(remaining, goal.currencyCode)} size="label" showSign={false} tabular />
          </p>
        ) : (
          <p className="t-body" style={{ margin: 0, color: "var(--good)", textAlign: "center" }}>{t("goalsPage.reached")}</p>
        )}
        {!account ? (
          <p className="t-body" style={{ margin: 0, color: "var(--text-muted)", textAlign: "center", fontSize: 13 }}>{t("goalsPage.noAccountLinked")}</p>
        ) : remaining > 0n ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("goalsPage.realPace")}</div>
            <Amount value={money(monthlyRate, goal.currencyCode)} size="label" showSign tabular polarity={monthlyRate >= 0n ? "positive" : "negative"} />
            <div className="t-caption" style={{ color: "var(--text-muted)", marginTop: 8 }}>{t("goalsPage.estimatedArrival")}</div>
            <div style={{ fontSize: 15, color: "var(--text-primary)" }}>{arrivalDate ? formatDateShort(locale, arrivalDate) : t("goalsPage.arrivalUnknown")}</div>
          </div>
        ) : null}
        <Button variant="danger" fullWidth={false} onClick={handleDelete} style={{ alignSelf: "center", marginTop: 12 }}>
          {t("goalsPage.delete")}
        </Button>
      </div>
    </div>
  );
}
