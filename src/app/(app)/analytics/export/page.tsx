"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button, Switch, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { usePayees } from "@/hooks/use-payees";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { previousClosedPeriodBounds, currentPeriodBounds } from "@/lib/analytics/history";
import { toCsv } from "@/lib/export/csv";
import { formatAmount } from "@/lib/money/format";
import { money } from "@/lib/money/money";
import { formatMonthYear } from "@/i18n/formatting";
import type { Locale } from "@/i18n/formatting";

type PeriodOption = "current" | "previous" | "twoAgo";

/** H13 — exportar movimientos de un período a CSV. Formato único (CSV); backup completo multi-tabla vive en K10 (`/more/export`). */
export default function ExportReportsPage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  usePageHeader({ title: t("exportReportsPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });
  const { data: household } = useCurrentHousehold();
  const { data: transactions } = useTransactions(household?.id);
  const { data: categories } = useCategories(household?.id);
  const { data: accounts } = useAccounts(household?.id);
  const { data: payees } = usePayees(household?.id);
  const categoryLabel = useCategoryLabel();
  const [period, setPeriod] = useState<PeriodOption>("previous");
  const [includeAccounts, setIncludeAccounts] = useState(true);

  const bounds = useMemo(() => {
    if (!household) return null;
    const periodStartDay = household.periodStartDay || 1;
    const now = new Date();
    if (period === "current") return currentPeriodBounds(periodStartDay, now);
    const prev = previousClosedPeriodBounds(periodStartDay, now);
    if (period === "previous") return prev;
    return { start: new Date(prev.start.getFullYear(), prev.start.getMonth() - 1, periodStartDay), end: prev.start };
  }, [household, period]);

  if (!household || !transactions || !categories || !accounts || !payees || !bounds) return null;

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const payeeById = new Map(payees.map((p) => [p.id, p]));

  const periodTxs = transactions.filter((tx) => {
    const occurred = new Date(tx.occurredAt);
    return occurred >= bounds.start && occurred < bounds.end;
  });

  const filenameLabel = formatMonthYear(locale, bounds.start).replace(/\s+/g, "-").toLowerCase();

  const handleExport = () => {
    const rows = periodTxs.map((tx) => [
      tx.occurredAt,
      tx.kind,
      accountById.get(tx.accountId)?.name ?? tx.accountId,
      tx.categoryId ? categoryLabel(categoryById.get(tx.categoryId) ?? { name: tx.categoryId, i18nKey: null, isSystem: false }) : "",
      tx.payeeId ? (payeeById.get(tx.payeeId)?.name ?? tx.payeeId) : "",
      formatAmount(money(tx.amount, tx.currencyCode)),
      tx.amountBase !== null ? formatAmount(money(tx.amountBase, household.baseCurrency)) : "",
      tx.note ?? "",
    ]);
    let csv = toCsv([t("exportReportsPage.csvDate"), t("exportReportsPage.csvKind"), t("exportReportsPage.csvAccount"), t("exportReportsPage.csvCategory"), t("exportReportsPage.csvPayee"), t("exportReportsPage.csvAmount"), t("exportReportsPage.csvAmountBase"), t("exportReportsPage.csvNote")], rows);

    if (includeAccounts) {
      csv += "\r\n\r\n" + toCsv([t("exportReportsPage.csvAccountName"), t("exportReportsPage.csvBalance")], accounts.map((a) => [a.name, formatAmount(money(a.currentBalance, a.currencyCode))]));
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `perze-${filenameLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("exportReportsPage.period")}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {(["twoAgo", "previous", "current"] as PeriodOption[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPeriod(option)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: "var(--radius-control)",
                  border: 0,
                  background: option === period ? "var(--primary-fill)" : "var(--surface-2)",
                  color: option === period ? "var(--primary-on-fill)" : "var(--text-primary)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t(`exportReportsPage.periodOptions.${option}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("exportReportsPage.whatsIncluded")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 56 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, color: "var(--text-primary)" }}>{t("exportReportsPage.transactions")}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("exportReportsPage.transactionsCount", { count: periodTxs.length })}</div>
            </div>
            <Switch checked disabled onChange={() => {}} id="export-transactions" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 56 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, color: "var(--text-primary)" }}>{t("exportReportsPage.accountsAndBalances")}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("exportReportsPage.accountsCount", { count: accounts.length })}</div>
            </div>
            <Switch checked={includeAccounts} onChange={setIncludeAccounts} id="export-accounts" />
          </div>
        </div>

        <p className="t-caption" style={{ color: "var(--text-muted)" }}>{t("exportReportsPage.needsFxNote")}</p>

        <div style={{ marginTop: "auto", paddingBottom: 24, display: "flex", flexDirection: "column", gap: 6 }}>
          <Button onClick={handleExport} disabled={periodTxs.length === 0}>
            {t("exportReportsPage.export")}
          </Button>
          <p className="t-caption" style={{ color: "var(--text-muted)", textAlign: "center" }}>
            {t("exportReportsPage.promise")}
          </p>
        </div>
      </div>
    </div>
  );
}
