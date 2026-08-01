"use client";

import type { CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import { KeypadKey, VISUALLY_HIDDEN_STYLE } from "./KeypadKey";
import { decimalSeparatorForLocale, type Locale } from "@/i18n/formatting";

const OPS = ["+", "−", "×", "÷"];

export interface KeypadProps {
  /** Recibe '0'-'9', el separador decimal del locale, '+', '−', '×', '÷' o 'backspace'. */
  onKey: (key: string) => void;
  /** Long-press en backspace limpia toda la entrada. */
  onClear?: (() => void) | undefined;
  /**
   * CON-12: el monto formateado a anunciar por `aria-live` en cada tecla —
   * `Keypad` no calcula plata, solo expone la región; el caller (que ya
   * tiene `formatAmount()`) le pasa el texto final.
   */
  announceValue?: string | undefined;
  gap?: number | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Teclado numérico de pantalla completa — el componente más usado de la
 * app. Teclas 64px, dígitos 32px, haptic de 8ms por tecla.
 *
 * D13/auditoría: la tecla decimal estaba hardcodeada a "," — en un locale
 * `en-US` (separador ".") tipear el separador "correcto" para ese locale
 * producía un carácter que `evaluateKeypadExpression`/`parseAmountString`
 * no reconocían como decimal. Ahora se deriva de `useLocale()` vía
 * `decimalSeparatorForLocale` — el mismo helper que ya usan `Amount`/
 * `FxEditor`/`RateRow` para MOSTRAR números, acá para el teclado que los
 * escribe.
 */
export function Keypad({ onKey, onClear, announceValue, gap = 8, style }: KeypadProps) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const decimalSeparator = decimalSeparatorForLocale(locale);
  const KEYS = [
    ["1", "2", "3", "+"],
    ["4", "5", "6", "−"],
    ["7", "8", "9", "×"],
    [decimalSeparator, "0", "backspace", "÷"],
  ];
  const ARIA_LABEL: Record<string, string> = {
    "+": t("ds.keypad.operatorPlus"),
    "−": t("ds.keypad.operatorMinus"),
    "×": t("ds.keypad.operatorMultiply"),
    "÷": t("ds.keypad.operatorDivide"),
    backspace: t("ds.keypad.backspace"),
    [decimalSeparator]: t("ds.keypad.decimalSeparator"),
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap, ...style }}>
      {announceValue !== undefined ? (
        <div role="status" aria-live="polite" style={VISUALLY_HIDDEN_STYLE}>
          {announceValue}
        </div>
      ) : null}
      {KEYS.flat().map((k) => (
        <KeypadKey key={k} label={k} muted={OPS.includes(k)} onPress={onKey} onLongPress={k === "backspace" ? onClear : undefined} ariaLabel={ARIA_LABEL[k]} />
      ))}
    </div>
  );
}
