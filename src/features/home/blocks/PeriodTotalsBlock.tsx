"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PrivacyBlur, StatTile } from "@/design-system";
import { formatAmountCompact } from "@/lib/money/format";
import { abs } from "@/lib/money/money";
import { usePrivacyStore } from "@/stores/privacy-store";
import { useHomeData } from "../home-data";
import { FitStatValue } from "./FitStatValue";

export function PeriodTotalsBlock() {
  const t = useTranslations();
  const router = useRouter();
  const { periodStart, expenseThisPeriod, incomeThisPeriod, wantsUsd, expenseThisPeriodUsd, incomeThisPeriodUsd, periodSurplus, periodSurplusCmp } = useHomeData();
  const privacy = usePrivacyStore((s) => s.privacyMode);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <section style={{ display: "flex", gap: 24 }}>
        <button
          type="button"
          // Sin `kind=expense`: el total de acá incluye compras/ventas de
          // instrumentos (`cash-flow.ts`), y ese filtro dejaría afuera
          // justo lo que hizo cambiar la cifra.
          onClick={() => router.push(`/transactions?from=${encodeURIComponent(periodStart)}`)}
          style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: 0, padding: 0, cursor: "pointer" }}
        >
          <StatTile
            label={t("home.outflowThisPeriod")}
            value={
              <PrivacyBlur active={privacy} style={{ display: "block", width: "100%" }}>
                <FitStatValue text={formatAmountCompact(wantsUsd && expenseThisPeriodUsd.data ? expenseThisPeriodUsd.data : expenseThisPeriod, { showSign: false })} />
              </PrivacyBlur>
            }
          />
        </button>
        <button
          type="button"
          // Mismo motivo que el botón de egresos: una venta de instrumentos
          // suma acá y el filtro `kind=income` la dejaría afuera.
          onClick={() => router.push(`/transactions?from=${encodeURIComponent(periodStart)}`)}
          style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: 0, padding: 0, cursor: "pointer" }}
        >
          <StatTile
            label={t("home.incomeThisPeriod")}
            value={
              <PrivacyBlur active={privacy} style={{ display: "block", width: "100%" }}>
                <FitStatValue text={formatAmountCompact(wantsUsd && incomeThisPeriodUsd.data ? incomeThisPeriodUsd.data : incomeThisPeriod, { showSign: false })} />
              </PrivacyBlur>
            }
          />
        </button>
      </section>
      {periodSurplusCmp !== 0 ? (
        <PrivacyBlur active={privacy}>
          <span style={{ fontSize: 13, fontWeight: 500, color: periodSurplusCmp > 0 ? "var(--money-positive)" : "var(--money-negative-emphasis)" }}>
            {periodSurplusCmp > 0 ? "↑" : "↓"} {formatAmountCompact(abs(periodSurplus), { showSign: false })}
          </span>
        </PrivacyBlur>
      ) : null}
    </div>
  );
}
