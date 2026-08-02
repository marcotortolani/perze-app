"use client";

import type { CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import { KeypadKey, VISUALLY_HIDDEN_STYLE } from "./KeypadKey";
import { decimalSeparatorForLocale, type Locale } from "@/i18n/formatting";

const OPS = ["+", "−", "×", "÷"];

export interface KeypadProps {
  /** Recibe '0'-'9', el separador decimal del locale, '+', '−', '×', '÷', '=' o 'backspace'. */
  onKey: (key: string) => void;
  /** Long-press en backspace limpia toda la entrada. */
  onClear?: (() => void) | undefined;
  /**
   * CON-12: el monto formateado a anunciar por `aria-live` en cada tecla —
   * `Keypad` no calcula plata, solo expone la región; el caller (que ya
   * tiene `formatAmount()`) le pasa el texto final.
   */
  announceValue?: string | undefined;
  /**
   * Default `true`. En `false` no se dibuja la columna de operadores —
   * para el teclado de tipo de cambio (`/currencies`), donde `+ − × ÷`
   * eran botones muertos: `rate-keypad.ts` los ignora al procesar la
   * tecla, así que estaban ahí sin hacer nada. La grilla pasa de 4 a 3
   * columnas, sin hueco vacío en su lugar.
   */
  operators?: boolean | undefined;
  /**
   * Default `false`. En `true` suma una fila con la tecla "=" — la
   * captura evalúa la expresión en cada tecla para el héroe, pero el
   * usuario no veía la expresión cruda que estaba construyendo ("12+8" se
   * mostraba ya resuelto en 12). Con `equals`, el caller es responsable de
   * mostrar la expresión cruda aparte y de resolverla recién al tocar
   * esta tecla, no en cada dígito — ver `AmountStep`.
   */
  equals?: boolean | undefined;
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
export function Keypad({ onKey, onClear, announceValue, operators = true, equals = false, gap = 8, style }: KeypadProps) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const decimalSeparator = decimalSeparatorForLocale(locale);
  const columns = operators ? 4 : 3;
  const KEYS = operators
    ? [
        ["1", "2", "3", "+"],
        ["4", "5", "6", "−"],
        ["7", "8", "9", "×"],
        [decimalSeparator, "0", "backspace", "÷"],
      ]
    : [
        ["1", "2", "3"],
        ["4", "5", "6"],
        ["7", "8", "9"],
        [decimalSeparator, "0", "backspace"],
      ];
  const ARIA_LABEL: Record<string, string> = {
    "+": t("ds.keypad.operatorPlus"),
    "−": t("ds.keypad.operatorMinus"),
    "×": t("ds.keypad.operatorMultiply"),
    "÷": t("ds.keypad.operatorDivide"),
    "=": t("ds.keypad.equals"),
    backspace: t("ds.keypad.backspace"),
    [decimalSeparator]: t("ds.keypad.decimalSeparator"),
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns},1fr)`, gap, ...style }}>
      {announceValue !== undefined ? (
        <div role="status" aria-live="polite" style={VISUALLY_HIDDEN_STYLE}>
          {announceValue}
        </div>
      ) : null}
      {KEYS.flat().map((k) => (
        <KeypadKey key={k} label={k} muted={OPS.includes(k)} onPress={onKey} onLongPress={k === "backspace" ? onClear : undefined} ariaLabel={ARIA_LABEL[k]} />
      ))}
      {equals ? (
        <div style={{ gridColumn: `1 / -1` }}>
          <KeypadKey label="=" onPress={onKey} ariaLabel={ARIA_LABEL["="]} fullWidth />
        </div>
      ) : null}
    </div>
  );
}
