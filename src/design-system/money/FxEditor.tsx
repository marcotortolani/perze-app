"use client";

import type { CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "../core/Icon";
import { StatusBadge } from "../core/StatusBadge";
import { CURRENCY_SYMBOLS } from "@/lib/money/format";
import { formatRate, parseRate, type ScaledRate } from "@/lib/fx/rate";
import { numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";

function displayRate(rate: ScaledRate, toCurrency: string, locale: Locale): string {
  const [intPart, fracPart = ""] = formatRate(rate).split(".");
  const symbol = CURRENCY_SYMBOLS[toCurrency.toUpperCase()] ?? toCurrency;
  const groupedInt = new Intl.NumberFormat(numberLocaleForUiLocale(locale)).format(BigInt(intPart ?? "0"));
  return `${symbol} ${groupedInt},${fracPart.slice(0, 2).padEnd(2, "0")}`;
}

export interface FxEditorProps {
  from?: string | undefined;
  to?: string | undefined;
  /** Rate actual (posiblemente ajustado a mano). */
  rate: ScaledRate;
  /** La sugerencia sobre la que se centra el slider fino ±5%. */
  suggested?: ScaledRate | undefined;
  /** Proveedor + tipo de cotización, debajo del slider. */
  source?: string | undefined;
  ageHours?: number | undefined;
  /** Badge de advertencia cuando el dato está desactualizado. */
  stale?: boolean | undefined;
  onChange?: ((rate: ScaledRate) => void) | undefined;
  onOpenKeypad?: (() => void) | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Rate de FX sugerido como cifra héroe, con fuente, badge de antigüedad y
 * un slider fino de ±5%. El slider selecciona por SUPERFICIE — el track y
 * el thumb no gastan el único violeta admitido de la pantalla (corrección
 * declarada en `perze-design/Bloque-E_.../readme` sobre la especificación
 * original, que lo pedía en relleno de marca).
 */
export function FxEditor({
  from = "USD",
  to = "UYU",
  rate,
  suggested,
  source,
  ageHours = 0,
  stale = false,
  onChange,
  onOpenKeypad,
  style,
}: FxEditorProps) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const resolvedSource = source ?? t("ds.fxEditor.source");
  const baseRate = suggested ?? rate;
  const baseRateNumber = Number(formatRate(baseRate));
  const rateNumber = Number(formatRate(rate));
  const pct = baseRateNumber === 0 ? 0 : Math.max(-5, Math.min(5, ((rateNumber - baseRateNumber) / baseRateNumber) * 100));

  return (
    <div style={style}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 11,
              lineHeight: "16px",
              fontWeight: 500,
              letterSpacing: ".02em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            {from} → {to}
          </div>
          <button
            type="button"
            onClick={onOpenKeypad}
            aria-label={t("ds.fxEditor.editRate")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "none",
              border: 0,
              padding: 0,
              marginTop: 4,
              cursor: "pointer",
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-hero-size)",
              lineHeight: "var(--text-hero-line)",
              fontWeight: 600,
              letterSpacing: "var(--text-hero-track)",
            }}
          >
            {displayRate(rate, to, locale)}
            <Icon name="edit" size={18} strokeWidth={1.75} color="var(--text-muted)" />
          </button>
        </div>
        {stale ? (
          <StatusBadge status="warning" icon="clock">
            {t("ds.fxEditor.ageHours", { hours: ageHours })}
          </StatusBadge>
        ) : null}
      </div>
      <input
        type="range"
        min={-5}
        max={5}
        step={0.1}
        value={pct}
        onChange={(e) => {
          const nextPct = Number(e.target.value);
          const nextNumber = baseRateNumber * (1 + nextPct / 100);
          onChange?.(parseRate(nextNumber.toFixed(12)));
        }}
        style={{ width: "100%", margin: "16px 0 8px", accentColor: "var(--surface-3)" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
        <span>{"−5%"}</span>
        <span>{resolvedSource}</span>
        <span>{"+5%"}</span>
      </div>
    </div>
  );
}
