"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { EmptyState, ListRow, Skeleton, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useInstruments, usePortfolioFromParam, usePortfolios, useTrades } from "@/hooks/use-investments";
import { computePositions } from "@/lib/analytics/positions";
import { computeFutureIncome } from "@/lib/analytics/future-income";
import { formatAmountCompact } from "@/lib/money/format";
import { formatDateShort } from "@/i18n/formatting";
import type { Locale } from "@/i18n/formatting";
import { money } from "@/lib/money/money";

const MONTHS_AHEAD = 24;

/** I11 — calendario de renta futura: cupones y amortizaciones proyectadas de bonos/ONs/letras/plazos fijos en cartera. */
export default function FutureIncomePage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: portfolios } = usePortfolios(household?.id);
  const portfolio = usePortfolioFromParam(portfolios);
  const { data: trades } = useTrades(portfolio?.id);
  const { data: instruments } = useInstruments(household?.id);

  const events = useMemo(() => {
    if (!trades || !instruments) return [];
    const positions = computePositions(trades.map((tr) => ({ instrumentId: tr.instrumentId, kind: tr.kind, quantity: tr.quantity, netAmount: tr.netAmount })));
    const instrumentById = new Map(instruments.map((i) => [i.id, i]));
    const fixedIncomePositions = [...positions.values()]
      .map((position) => {
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
      .filter((p): p is NonNullable<typeof p> => p !== null);
    return computeFutureIncome(fixedIncomePositions, new Date(), MONTHS_AHEAD);
  }, [trades, instruments]);
  usePageHeader({ title: t("futureIncomePage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  if (!household || !portfolios || !trades || !instruments) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  if (!portfolio || events.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <EmptyState message={t("futureIncomePage.empty")} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", paddingBottom: 24 }}>
        {events.map((event, i) => (
          <ListRow
            key={`${event.instrumentId}-${event.date}-${i}`}
            label={event.symbol}
            meta={`${formatDateShort(locale, new Date(event.date))} · ${t(`futureIncomePage.kind.${event.kind}`)}`}
            variant="value"
            value={formatAmountCompact(money(event.amount, event.currencyCode), { showSign: false })}
          />
        ))}
      </div>
    </div>
  );
}
