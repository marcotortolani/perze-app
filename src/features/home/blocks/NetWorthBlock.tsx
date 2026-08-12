"use client";

import { useTranslations } from "next-intl";
import { Icon, PrivacyBlur, SegmentedControl, Skeleton } from "@/design-system";
import { Sparkline } from "@/design-system/charts";
import { ContextualTooltip } from "@/design-system/systems";
import { CountUp } from "@/components/motion";
import { formatAmountCompact } from "@/lib/money/format";
import { abs, subtract } from "@/lib/money/money";
import { usePrivacyStore } from "@/stores/privacy-store";
import { useContextualTooltipStore } from "@/stores/contextual-tooltip-store";
import { useNetWorthCurrencyStore } from "@/stores/net-worth-currency-store";
import { useHomeData } from "../home-data";

export function NetWorthBlock() {
  const t = useTranslations();
  const { baseCurrency, netWorth, heroMoney, heroFxPending, deltaPolarity, deltaArrow, last7Net, prev7Net, heroTrend } = useHomeData();
  const privacy = usePrivacyStore((s) => s.privacyMode);
  const togglePrivacy = usePrivacyStore((s) => s.toggle);
  const seenPrivacyTooltip = useContextualTooltipStore((s) => s.hasSeen("home-privacy-toggle"));
  const markPrivacyTooltipSeen = useContextualTooltipStore((s) => s.markSeen);
  const netWorthDisplayCurrency = useNetWorthCurrencyStore((s) => s.displayCurrency);
  const setNetWorthDisplayCurrency = useNetWorthCurrencyStore((s) => s.setDisplayCurrency);

  return (
    <section style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="t-caption" style={{ color: "var(--text-muted)", letterSpacing: ".08em", textTransform: "uppercase" }}>
          {t("home.netWorth")}
        </span>
        {seenPrivacyTooltip ? (
          <button type="button" onClick={togglePrivacy} aria-label={privacy ? t("home.showAmounts") : t("home.hideAmounts")} style={{ background: "none", border: 0, padding: 4, cursor: "pointer" }}>
            <Icon name={privacy ? "eye-off" : "eye"} size={15} color="var(--text-muted)" />
          </button>
        ) : (
          <ContextualTooltip message={t("home.privacyTooltip")} onDismiss={() => markPrivacyTooltipSeen("home-privacy-toggle")}>
            <button type="button" onClick={togglePrivacy} aria-label={privacy ? t("home.showAmounts") : t("home.hideAmounts")} style={{ background: "none", border: 0, padding: 4, cursor: "pointer" }}>
              <Icon name={privacy ? "eye-off" : "eye"} size={15} color="var(--text-muted)" />
            </button>
          </ContextualTooltip>
        )}
        {baseCurrency !== "USD" ? (
          <SegmentedControl
            options={[baseCurrency, "USD"]}
            value={netWorthDisplayCurrency === "usd" ? "USD" : baseCurrency}
            onChange={(id) => setNetWorthDisplayCurrency(id === "USD" ? "usd" : "base")}
            size="sm"
          />
        ) : null}
      </div>
      {netWorth.data ? (
        heroMoney ? (
          <CountUp value={heroMoney.amount} currency={heroMoney.currency} size="hero" fit showSign={false} polarity="neutral" privacy={privacy} />
        ) : (
          <CountUp value={netWorth.data.netWorth.amount} currency={baseCurrency} size="hero" fit showSign={false} polarity="neutral" privacy={privacy} />
        )
      ) : (
        <Skeleton width={180} height={44} />
      )}
      {heroFxPending ? (
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("home.netWorthUsdPending", { currency: baseCurrency })}</span>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <PrivacyBlur active={privacy}>
          <span style={{ fontSize: 13, fontWeight: 500, color: deltaPolarity === "positive" ? "var(--money-positive)" : "var(--money-negative-emphasis)" }}>
            {deltaArrow} {formatAmountCompact(abs(subtract(last7Net, prev7Net)), { showSign: false })}
          </span>
        </PrivacyBlur>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("home.vsLastWeek")}</span>
      </div>
      <Sparkline values={heroTrend} width={140} height={32} color={deltaPolarity === "positive" ? "var(--data-1)" : "var(--money-negative-emphasis)"} />
      {netWorth.data && netWorth.data.excludedAccountIds.length > 0 ? (
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {t("home.excludedAccounts", { count: netWorth.data.excludedAccountIds.length })}
        </span>
      ) : null}
    </section>
  );
}
