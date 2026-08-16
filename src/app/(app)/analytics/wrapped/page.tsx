"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, EmptyState, NeedsFxBanner, Skeleton, StoryFrame } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { usePayees } from "@/hooks/use-payees";
import { useTransactions } from "@/hooks/use-transactions";
import { useNetWorth } from "@/hooks/use-net-worth";
import { closedPeriodsCount, currentPeriodBounds } from "@/lib/analytics/history";
import { computeWrappedSummary } from "@/lib/analytics/wrapped";
import { formatAmountCompact, formatNumber } from "@/lib/money/format";
import { money } from "@/lib/money/money";

/**
 * `bloque-h-analisis.html` dice "6 meses cumplidos", pero `adenda-01-huecos-
 * navegacion.html` —que manda para H1 y su entrada a H12 (`docs/design/
 * INDEX.md`)— lo corrige a 12: "deshabilitada hasta que haya 12 meses
 * cerrados". Una vez al año, no por semestre.
 */
const REQUIRED_CLOSED_PERIODS = 12;
const TOTAL_FRAMES = 6;

/** H12 — Wrapped anual: seis frames, una cifra por pantalla. Gate estructural: 12 períodos cerrados (adenda-01, no los 6 del archivo base). */
export default function WrappedPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: accounts } = useAccounts(household?.id);
  const { data: transactions } = useTransactions(household?.id);
  const { data: payees } = usePayees(household?.id);
  const netWorth = useNetWorth(household?.id, household?.baseCurrency, accounts ?? [], household?.enabledModules.includes("investments"));
  const [frame, setFrame] = useState(0);

  const firstOccurredAt = (transactions ?? []).reduce<string | undefined>((min, tx) => (min === undefined || tx.occurredAt < min ? tx.occurredAt : min), undefined);
  const closedPeriods = household ? closedPeriodsCount(firstOccurredAt, household.periodStartDay || 1, new Date()) : 0;

  const summary = useMemo(() => {
    if (!household || !transactions || closedPeriods < REQUIRED_CLOSED_PERIODS) return null;
    const { start: periodEnd } = currentPeriodBounds(household.periodStartDay || 1, new Date());
    const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth() - REQUIRED_CLOSED_PERIODS, household.periodStartDay || 1);
    return computeWrappedSummary(transactions, periodStart, periodEnd);
  }, [household, transactions, closedPeriods]);

  if (!household || !accounts || !transactions || !payees) return <Skeleton height={400} style={{ marginTop: 16 }} />;

  if (closedPeriods < REQUIRED_CLOSED_PERIODS) {
    return <EmptyState message={t("wrappedPage.needsHistory", { count: REQUIRED_CLOSED_PERIODS - closedPeriods })} />;
  }

  if (!summary) return <Skeleton height={400} style={{ marginTop: 16 }} />;

  const baseCurrency = household.baseCurrency;
  const topPayeeName = summary.topPayee ? (payees.find((p) => p.id === summary.topPayee!.payeeId)?.name ?? summary.topPayee.payeeId) : null;

  const advance = (delta: number) => setFrame((f) => Math.max(0, Math.min(TOTAL_FRAMES - 1, f + delta)));

  const frames = [
    <StoryFrame
      key={0}
      index={0}
      total={TOTAL_FRAMES}
      style={{ background: "var(--primary-fill)", color: "#FFFFFF" }}
      figure={<div style={{ fontFamily: "var(--font-sans)", fontSize: 40, fontWeight: 600, letterSpacing: "-.02em", color: "#FFFFFF" }}>{t("wrappedPage.coverTitle")}</div>}
      line={<span style={{ color: "color-mix(in srgb, #FFFFFF 80%, transparent)" }}>{t("wrappedPage.coverSubtitle")}</span>}
    />,
    <StoryFrame
      key={1}
      index={1}
      total={TOTAL_FRAMES}
      figure={<div style={{ fontFamily: "var(--font-sans)", fontSize: 56, fontWeight: 600, letterSpacing: "-.02em" }}>{formatAmountCompact(netWorth.data?.netWorth ?? money(0n, baseCurrency), { showSign: false })}</div>}
      line={t("wrappedPage.netWorthLine")}
    />,
    <StoryFrame
      key={2}
      index={2}
      total={TOTAL_FRAMES}
      figure={<div style={{ fontFamily: "var(--font-sans)", fontSize: 56, fontWeight: 600, letterSpacing: "-.02em" }}>{summary.transactionCount}</div>}
      line={t("wrappedPage.transactionCountLine")}
    />,
    <StoryFrame
      key={3}
      index={3}
      total={TOTAL_FRAMES}
      figure={<div style={{ fontFamily: "var(--font-sans)", fontSize: 56, fontWeight: 600, letterSpacing: "-.02em" }}>{topPayeeName ?? "—"}</div>}
      line={summary.topPayee ? t("wrappedPage.topPayeeLine", { visits: summary.topPayee.visits, amount: formatAmountCompact(money(summary.topPayee.total, baseCurrency), { showSign: false }) }) : t("wrappedPage.noPayeeData")}
    />,
    <StoryFrame
      key={4}
      index={4}
      total={TOTAL_FRAMES}
      figure={<div style={{ fontFamily: "var(--font-sans)", fontSize: 56, fontWeight: 600, letterSpacing: "-.02em" }}>{summary.savingsRatePct !== null ? `${formatNumber(summary.savingsRatePct, 1)}%` : "—"}</div>}
      line={t("wrappedPage.savingsRateLine")}
    />,
    <StoryFrame
      key={5}
      index={5}
      total={TOTAL_FRAMES}
      figure={<div style={{ fontFamily: "var(--font-sans)", fontSize: 56, fontWeight: 600, letterSpacing: "-.02em" }}>{summary.daysActive}</div>}
      line={
        <div style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
          <span>{t("wrappedPage.daysActiveLine")}</span>
          <Button
            onClick={async () => {
              if (navigator.share) await navigator.share({ title: t("wrappedPage.coverTitle"), text: t("wrappedPage.shareText") });
            }}
          >
            {t("wrappedPage.share")}
          </Button>
        </div>
      }
    />,
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--page)" }}>
      {frames[frame]}
      {/* Solo en la portada (frame 0): `StoryFrame` no tiene un slot para
          esto (`figure`/`line`/`cover` nada más, ver el componente) y
          meterlo en cada frame competiría con "una cifra, una pantalla" —
          la razón de ser de este diseño. Se avisa una sola vez, al
          arrancar, en vez de en cada cifra que pueda estar subcontada. */}
      {frame === 0 ? (
        <NeedsFxBanner
          count={summary.excludedCount}
          onResolve={() => router.push("/accounts/resolve-fx")}
          style={{ position: "absolute", top: "env(safe-area-inset-top)", left: 0, right: 0, zIndex: 1 }}
        />
      ) : null}
      <button
        type="button"
        aria-label={t("wrappedPage.back")}
        onClick={() => (frame === 0 ? router.back() : advance(-1))}
        style={{ position: "absolute", top: 0, left: 0, width: "30%", height: frame === TOTAL_FRAMES - 1 ? "80%" : "100%", background: "none", border: 0 }}
      />
      {frame < TOTAL_FRAMES - 1 ? (
        <button type="button" aria-label={t("wrappedPage.next")} onClick={() => advance(1)} style={{ position: "absolute", top: 0, right: 0, width: "70%", height: "100%", background: "none", border: 0 }} />
      ) : null}
    </div>
  );
}
