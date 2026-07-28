"use client";

import type { CSSProperties } from "react";
import { useLocale } from "next-intl";
import { StatusBadge } from "../core/StatusBadge";
import { formatRate, type ScaledRate } from "@/lib/fx/rate";
import { decimalSeparatorForLocale, type Locale } from "@/i18n/formatting";

export interface RateRowProps {
  /** "USD → ARS". */
  pair: string;
  source: string;
  ageLabel: string;
  rate: ScaledRate;
  stale?: boolean | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Par + fuente + antigüedad + cifra en mono + badge — se repetía a mano
 * en tres lugares del Bloque E (E6 monedas y tipos de cambio). Depende de
 * poder pasar un `ReactNode` como `meta` de `ListRow`; se resuelve solo
 * cuando esa API lo permita.
 */
export function RateRow({ pair, source, ageLabel, rate, stale = false, style }: RateRowProps) {
  const locale = useLocale() as Locale;
  const [intPart, fracPart = ""] = formatRate(rate).split(".");
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 0", ...style }}>
      <div>
        <div style={{ fontSize: 15, color: "var(--text-primary)" }}>{pair}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
          {source} · {ageLabel}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 15, color: "var(--text-primary)" }}>
          {`${intPart}${decimalSeparatorForLocale(locale)}${fracPart.slice(0, 2).padEnd(2, "0")}`}
        </span>
        {stale ? (
          <StatusBadge status="warning" icon="clock">
            {ageLabel}
          </StatusBadge>
        ) : null}
      </div>
    </div>
  );
}
