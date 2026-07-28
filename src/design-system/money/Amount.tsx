"use client";

import type { CSSProperties } from "react";
import { useLocale } from "next-intl";
import { CURRENCY_SYMBOLS } from "@/lib/money/format";
import { decimalsFor } from "@/lib/money/decimals";
import type { Money } from "@/lib/money/money";
import { decimalSeparatorForLocale, numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";

const SIZES: Record<string, CSSProperties> = {
  "hero-xl": {
    fontSize: "var(--text-hero-xl-size)",
    lineHeight: "var(--text-hero-xl-line)",
    fontWeight: 600,
    letterSpacing: "var(--text-hero-xl-track)",
  },
  hero: {
    fontSize: "var(--text-hero-size)",
    lineHeight: "var(--text-hero-line)",
    fontWeight: 600,
    letterSpacing: "var(--text-hero-track)",
  },
  title: {
    fontSize: "var(--text-title-size)",
    lineHeight: "var(--text-title-line)",
    fontWeight: 600,
    letterSpacing: "var(--text-title-track)",
  },
  body: { fontSize: "var(--text-body-size)", lineHeight: "var(--text-body-line)", fontWeight: 500 },
  label: { fontSize: "var(--text-label-size)", lineHeight: "var(--text-label-line)", fontWeight: 500 },
};

export interface AmountProps {
  /** Money — bigint en unidades mínimas. Nunca un `number`: ver `docs/00-producto.md` § 2.3. */
  value: Money;
  size?: "hero-xl" | "hero" | "title" | "body" | "label" | undefined;
  /**
   * Color — independiente del signo. `negative` = tinta neutra (default
   * para gastos); `negative-emphasis` = naranja, para un gasto puntual
   * destacado; `neutral` = tinta primaria, para saldos y totales.
   * Por defecto `neutral` cuando `showSign` es `false`.
   */
  polarity?: "positive" | "negative" | "negative-emphasis" | "neutral" | undefined;
  /** El glifo +/−, derivado del signo del valor e independiente de `polarity`. */
  showSign?: boolean | undefined;
  showArrow?: boolean | undefined;
  /** `tabular-nums` + mono: solo en columnas que tienen que alinear verticalmente. */
  tabular?: boolean | undefined;
  /** Atenúa la parte decimal — se usa en la cifra héroe del keypad. */
  mutedDecimals?: boolean | undefined;
  privacy?: boolean | undefined;
  style?: CSSProperties | undefined;
}

/**
 * El ÚNICO lugar donde se formatea plata en JSX: signo, símbolo, decimales
 * por moneda, color por polaridad, modo privacidad. Para texto plano (sin
 * JSX) usar `formatAmount`/`formatAmountCompact` de `lib/money`.
 */
export function Amount({
  value,
  size = "body",
  polarity,
  showSign = true,
  showArrow = false,
  tabular = false,
  mutedDecimals = false,
  privacy = false,
  style,
  ...rest
}: AmountProps) {
  const locale = useLocale() as Locale;
  const negative = value.amount < 0n;
  const pol = polarity ?? (!showSign ? "neutral" : negative ? "negative" : value.amount > 0n ? "positive" : "neutral");
  const color =
    pol === "positive" ? "var(--money-positive)" : pol === "negative-emphasis" ? "var(--money-negative-emphasis)" : "var(--money-negative)";

  const decimals = decimalsFor(value.currency);
  const divisor = 10n ** BigInt(decimals);
  const absAmount = negative ? -value.amount : value.amount;
  const intPart = absAmount / divisor;
  const fracPart = decimals > 0 ? (absAmount % divisor).toString().padStart(decimals, "0") : "";
  const intFormatted = new Intl.NumberFormat(numberLocaleForUiLocale(locale)).format(intPart);

  const sign = !showSign || value.amount === 0n ? "" : negative ? "−" : "+";
  const arrow = showArrow && value.amount !== 0n ? (negative ? "↓ " : "↑ ") : "";
  const symbol = CURRENCY_SYMBOLS[value.currency.toUpperCase()] ?? value.currency;

  return (
    <span
      style={{
        fontFamily: tabular ? "var(--font-mono)" : "var(--font-sans)",
        fontVariantNumeric: tabular ? "tabular-nums" : "proportional-nums",
        color,
        whiteSpace: "nowrap",
        ...SIZES[size],
        filter: privacy ? "blur(8px)" : "none",
        userSelect: privacy ? "none" : "auto",
        ...style,
      }}
      {...rest}
    >
      {arrow}
      {sign}
      {symbol}&nbsp;{intFormatted}
      {decimals > 0 ? (
        <span style={{ color: mutedDecimals ? "var(--text-muted)" : "inherit" }}>{`${decimalSeparatorForLocale(locale)}${fracPart}`}</span>
      ) : null}
    </span>
  );
}
