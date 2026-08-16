"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { InsightCard } from "@/design-system";
import { Sparkline } from "@/design-system/charts";
import type { IconName } from "@/design-system/core/Icon";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useCategoryDirectory } from "@/hooks/use-category-directory";
import { useAnomalyDismissalsStore } from "@/stores/anomaly-dismissals-store";
import { formatAmountCompact } from "@/lib/money/format";
import { money } from "@/lib/money/money";
import { useHomeData } from "../home-data";

/**
 * Cadena de prioridad: alerta de presupuesto → movimientos sin cotizar →
 * anomalía reciente (últimos `ANOMALY_RECENT_DAYS` días, ver `home-data.tsx`)
 * → categoría con más gasto. La anomalía va antes que la categoría con más
 * gasto porque es información específica y accionable sobre UN movimiento
 * (como needsFx), no un resumen genérico del período. `insightDismissed`
 * queda local a este bloque (no sube al contexto compartido): es un
 * descarte efímero de sesión, no un dato que otro bloque necesite leer —
 * el descarte PERMANENTE de una anomalía puntual pasa por
 * `useAnomalyDismissalsStore`, abajo.
 */
export function InsightBlock() {
  const t = useTranslations();
  const router = useRouter();
  const categoryLabel = useCategoryLabel();
  const { budgetAlerts, categoryById, needsFxCount, recentAnomaly, topCategory, heroTrend, baseCurrency, household } = useHomeData();
  const anomalyCategoryLabel = useCategoryDirectory(household.id);
  const dismissAnomaly = useAnomalyDismissalsStore((s) => s.dismiss);
  const [insightDismissed, setInsightDismissed] = useState(false);

  if (insightDismissed) return null;

  if (budgetAlerts.length > 0) {
    return (
      <InsightCard
        status={budgetAlerts[0]!.level === "exceeded" ? "critical" : "warning"}
        icon="alert"
        text={t(budgetAlerts[0]!.level === "exceeded" ? "home.budgetExceededInsight" : "home.budgetWarningInsight", {
          category: budgetAlerts[0]!.budget.categoryId ? categoryLabel(categoryById.get(budgetAlerts[0]!.budget.categoryId!) ?? { name: budgetAlerts[0]!.budget.name, i18nKey: null, isSystem: false }) : budgetAlerts[0]!.budget.name,
          percent: Math.round(budgetAlerts[0]!.progress * 100),
        })}
        actionLabel={t("home.seeBudgets")}
        onAction={() => router.push("/budgets")}
        onDismiss={() => setInsightDismissed(true)}
        dismissLabel={t("ds.insightCard.dismiss")}
      />
    );
  }

  if (needsFxCount > 0) {
    return (
      <InsightCard
        status="warning"
        icon="alert"
        text={t("home.needsFxInsight", { count: needsFxCount })}
        actionLabel={t("home.seeTransactions")}
        onAction={() => router.push("/transactions?pending=1")}
        onDismiss={() => setInsightDismissed(true)}
        dismissLabel={t("ds.insightCard.dismiss")}
      />
    );
  }

  if (recentAnomaly) {
    return (
      <InsightCard
        status="warning"
        icon="alert"
        text={t("home.anomalyInsight", {
          category: anomalyCategoryLabel(recentAnomaly.categoryId),
          amount: formatAmountCompact(money(recentAnomaly.amountBase, baseCurrency), { showSign: false }),
          typical: formatAmountCompact(money(recentAnomaly.medianAmountBase, baseCurrency), { showSign: false }),
        })}
        actionLabel={t("home.seeAnomaly")}
        onAction={() => router.push("/analytics/anomalies")}
        onDismiss={() => {
          dismissAnomaly(recentAnomaly.transactionId);
          setInsightDismissed(true);
        }}
        dismissLabel={t("ds.insightCard.dismiss")}
      />
    );
  }

  if (topCategory) {
    return (
      <InsightCard
        status="neutral"
        icon={topCategory.icon as IconName}
        text={t.rich("home.topCategoryInsight", { category: categoryLabel(topCategory), b: (chunks) => <strong>{chunks}</strong> })}
        sparkline={<Sparkline values={heroTrend.map((v) => Math.max(v, 0))} width={96} height={24} />}
        onDismiss={() => setInsightDismissed(true)}
        dismissLabel={t("ds.insightCard.dismiss")}
      />
    );
  }

  return null;
}
