"use client";

import type { CSSProperties } from "react";
import { KeypadKey, VISUALLY_HIDDEN_STYLE } from "./KeypadKey";

const KEYS = [
  ["1", "2", "3", "+"],
  ["4", "5", "6", "−"],
  ["7", "8", "9", "×"],
  [",", "0", "backspace", "÷"],
];
const OPS = ["+", "−", "×", "÷"];

export interface KeypadProps {
  /** Recibe '0'-'9', ',', '+', '−', '×', '÷' o 'backspace'. */
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

/** Teclado numérico de pantalla completa — el componente más usado de la app. Teclas 64px, dígitos 32px, haptic de 8ms por tecla. */
export function Keypad({ onKey, onClear, announceValue, gap = 8, style }: KeypadProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap, ...style }}>
      {announceValue !== undefined ? (
        <div role="status" aria-live="polite" style={VISUALLY_HIDDEN_STYLE}>
          {announceValue}
        </div>
      ) : null}
      {KEYS.flat().map((k) => (
        <KeypadKey key={k} label={k} muted={OPS.includes(k)} onPress={onKey} onLongPress={k === "backspace" ? onClear : undefined} />
      ))}
    </div>
  );
}
