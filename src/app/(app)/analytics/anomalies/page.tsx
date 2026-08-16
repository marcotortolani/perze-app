"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { EmptyState, ErrorState, InsightCard, NeedsFxBanner, Skeleton, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategoryDirectory } from "@/hooks/use-category-directory";
import { useQueryErrorState } from "@/hooks/use-query-error-state";
import { detectAnomalies, MIN_CATEGORY_TRANSACTIONS } from "@/lib/analytics/anomaly-detection";
import { useAnomalyDismissalsStore } from "@/stores/anomaly-dismissals-store";
import { formatAmountCompact } from "@/lib/money/format";
import { formatDateShort, type Locale } from "@/i18n/formatting";
import { money } from "@/lib/money/money";

/**
 * Detección de anomalías (auditoría técnica 16-ago-2026, gap declarado):
 * marca movimientos individuales atípicos dentro de su categoría, con
 * mediana+MAD (`lib/analytics/anomaly-detection.ts`). Mínimo de historial
 * declarado: 20 movimientos en la categoría — hasta que una sola categoría
 * lo alcance, se muestra cuánto falta en vez de un análisis vacío.
 */
export default function AnomaliesPage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  usePageHeader({ title: t("anomaliesPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });
  const { data: household } = useCurrentHousehold();
  const transactionsQuery = useTransactions(household?.id);
  const { data: transactions } = transactionsQuery;
  const categoryLabel = useCategoryDirectory(household?.id);
  const dismissedIds = useAnomalyDismissalsStore((s) => s.dismissedIds);
  const dismiss = useAnomalyDismissalsStore((s) => s.dismiss);

  const errorState = useQueryErrorState(transactionsQuery, { what: t("anomaliesPage.loadError") });

  const { anomalies, excludedCount, maxCategoryCount } = useMemo(() => {
    if (!transactions) return { anomalies: [], excludedCount: 0, maxCategoryCount: 0 };
    const result = detectAnomalies(transactions);
    const countByCategory = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.deletedAt !== null || tx.status === "void" || tx.kind !== "expense" || !tx.categoryId || tx.amountBase === null) continue;
      countByCategory.set(tx.categoryId, (countByCategory.get(tx.categoryId) ?? 0) + 1);
    }
    const maxCount = countByCategory.size > 0 ? Math.max(...countByCategory.values()) : 0;
    return { ...result, maxCategoryCount: maxCount };
  }, [transactions]);

  if (errorState) return <ErrorState {...errorState} />;
  if (!household || !transactions) return <Skeleton height={220} style={{ marginTop: 16 }} />;

  const hasEnoughHistory = maxCategoryCount >= MIN_CATEGORY_TRANSACTIONS;
  const visibleAnomalies = anomalies.filter((a) => !dismissedIds.includes(a.transactionId));

  if (!hasEnoughHistory) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <EmptyState message={t("anomaliesPage.needsHistory", { count: Math.max(0, MIN_CATEGORY_TRANSACTIONS - maxCategoryCount) })} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {excludedCount > 0 ? (
        <NeedsFxBanner
          count={excludedCount}
          onResolve={() => router.push("/accounts/resolve-fx")}
          style={{ margin: "0 calc(-1 * var(--screen-padding))", borderRadius: 0 }}
        />
      ) : null}
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {visibleAnomalies.length === 0 ? (
          <EmptyState message={t("anomaliesPage.empty")} />
        ) : (
          visibleAnomalies.map((a) => (
            <InsightCard
              key={a.transactionId}
              status="warning"
              icon="alert"
              text={t("anomaliesPage.item", {
                category: categoryLabel(a.categoryId),
                amount: formatAmountCompact(money(a.amountBase, household.baseCurrency), { showSign: false }),
                typical: formatAmountCompact(money(a.medianAmountBase, household.baseCurrency), { showSign: false }),
                date: formatDateShort(locale, new Date(a.occurredAt)),
              })}
              actionLabel={t("anomaliesPage.seeTransaction")}
              onAction={() => router.push(`/transactions?tx=${a.transactionId}`)}
              onDismiss={() => dismiss(a.transactionId)}
              dismissLabel={t("ds.insightCard.dismiss")}
            />
          ))
        )}
      </div>
    </div>
  );
}
