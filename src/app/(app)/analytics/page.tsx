import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/design-system";

/** Analytics home (H1) — Bloque H, fuera del alcance de los bloques A–E. */
export default async function AnalyticsPage() {
  const t = await getTranslations();
  return <EmptyState icon="chart" message={t("analyticsPage.unavailable")} />;
}
