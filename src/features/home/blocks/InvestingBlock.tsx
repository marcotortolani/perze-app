"use client";

import { useTranslations } from "next-intl";
import { PrivacyBlur } from "@/design-system";
import { Sparkline } from "@/design-system/charts";
import { CountUp } from "@/components/motion";
import { formatAmountCompact } from "@/lib/money/format";
import { money, toMajorUnitsUnsafe } from "@/lib/money/money";
import { usePrivacyStore } from "@/stores/privacy-store";
import { useHomeData } from "../home-data";

/**
 * "Investing" — solo con el módulo prendido Y al menos una posición real
 * (`hasPositions`): un household que activó el módulo pero nunca cargó una
 * operación no tiene nada que mostrar acá, mismo criterio que "apagar un
 * módulo oculta" pero a la inversa (prendido sin uso real tampoco ocupa
 * espacio) — ver `isAvailable` en `registry.ts`. Mismo patrón visual que
 * el patrimonio neto — valor, delta vs. semana pasada, sparkline — para
 * que se lean como la misma familia de dato.
 */
export function InvestingBlock() {
  const t = useTranslations();
  const { baseCurrency, investmentsTrend } = useHomeData();
  const privacy = usePrivacyStore((s) => s.privacyMode);

  if (!investmentsTrend.data?.hasPositions) return null;

  const values = investmentsTrend.data.values;
  const current = values.at(-1) ?? 0n;
  const weekAgo = values.at(-8) ?? current;
  const delta = current - weekAgo;
  const investingDeltaPolarity = delta >= 0n ? "positive" : "negative";
  const investingDeltaArrow = delta >= 0n ? "↑" : "↓";

  return (
    <section style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <span className="t-caption" style={{ color: "var(--text-muted)", letterSpacing: ".08em", textTransform: "uppercase" }}>
        {t("home.investing")}
      </span>
      <CountUp value={current} currency={baseCurrency} size="hero" fit showSign={false} polarity="neutral" privacy={privacy} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <PrivacyBlur active={privacy}>
          <span style={{ fontSize: 13, fontWeight: 500, color: investingDeltaPolarity === "positive" ? "var(--money-positive)" : "var(--money-negative-emphasis)" }}>
            {investingDeltaArrow} {formatAmountCompact(money(delta < 0n ? -delta : delta, baseCurrency), { showSign: false })}
          </span>
        </PrivacyBlur>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("home.vsLastWeek")}</span>
      </div>
      <Sparkline values={values.map((v) => toMajorUnitsUnsafe(money(v, baseCurrency)))} width={140} height={32} color={investingDeltaPolarity === "positive" ? "var(--data-1)" : "var(--money-negative-emphasis)"} />
      {investmentsTrend.data.excludedCount > 0 ? (
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("home.investingExcluded", { count: investmentsTrend.data.excludedCount })}</span>
      ) : null}
    </section>
  );
}
