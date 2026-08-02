"use client";

import type { CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "../core/Icon";
import { StatusBadge } from "../core/StatusBadge";
import { CURRENCY_SYMBOLS } from "@/lib/money/format";
import { formatRateTrimmed, type ScaledRate } from "@/lib/fx/rate";
import { roundHalfEven } from "@/lib/money/money";
import { decimalSeparatorForLocale, numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";

/**
 * Sin ceros finales, no cortado a 2 decimales: una tasa invertida chica
 * (1 ARS = 0,00064 USD) necesita más dígitos para leerse, y un rate
 * "redondo" (1560,00) se muestra mejor sin el resto de ceros.
 */
function displayRate(rate: ScaledRate, toCurrency: string, locale: Locale): string {
  const [intPart, fracPart] = formatRateTrimmed(rate).split(".");
  const symbol = CURRENCY_SYMBOLS[toCurrency.toUpperCase()] ?? toCurrency;
  const groupedInt = new Intl.NumberFormat(numberLocaleForUiLocale(locale)).format(BigInt(intPart ?? "0"));
  return fracPart ? `${symbol} ${groupedInt}${decimalSeparatorForLocale(locale)}${fracPart}` : `${symbol} ${groupedInt}`;
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
  // Ningún rate pasa por `Number()`/`toFixed()` — la posición del slider se
  // deriva en bigint (décimos de punto porcentual: 23 = 2,3%) y recién al
  // final se angosta a `Number` para el `value` del `<input type="range">`,
  // que es un control nativo y no tiene otra forma de recibirlo. El único
  // punto que sí escribe un rate (el `onChange` de abajo) hace la cuenta
  // inversa en bigint, sin volver a pasar por acá.
  const pctTenths = baseRate === 0n ? 0n : ((rate - baseRate) * 1000n) / baseRate;
  const pct = Number(pctTenths < -50n ? -50n : pctTenths > 50n ? 50n : pctTenths) / 10;

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
          // El `<input type="range">` solo puede darnos un `number` — se
          // redondea al décimo de punto exacto (el `step` del slider) antes
          // de volver a bigint, así que el único float que se toca es un
          // entero pequeño (p. ej. 23 para 2,3%), nunca el rate en sí.
          const tenths = BigInt(Math.round(Number(e.target.value) * 10));
          const next = roundHalfEven(baseRate * (1000n + tenths), 1000n);
          onChange?.(next);
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
