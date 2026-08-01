"use client";

import { useRef, useState } from "react";
import { Icon } from "../core/Icon";

export interface KeypadKeyProps {
  label: string;
  /** `Keypad` distingue operadores (más tenues); `PinKeypad` no tiene variantes. */
  muted?: boolean | undefined;
  fontSize?: number | undefined;
  iconSize?: number | undefined;
  onPress: (key: string) => void;
  onLongPress?: (() => void) | undefined;
}

/**
 * CON-12 (docs/plan-de-trabajo.md § 4): `Keypad` y `PinKeypad` compartían
 * `KeypadKey` solo de palabra — cada uno tenía su propio `<button>`
 * duplicado. Comparten esto y nada más: `contrato-componentes.md` es
 * explícito en que no son una variante entre sí (valores de distinto tipo,
 * `aria-live` opuestos, modelos de error distintos) — no unificar más allá
 * de esta tecla.
 */
export function KeypadKey({ label, muted = false, fontSize = 32, iconSize = 24, onPress, onLongPress }: KeypadKeyProps) {
  const [pressed, setPressed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const down = () => {
    setPressed(true);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
    if (onLongPress) timer.current = setTimeout(onLongPress, 500);
  };
  const up = () => {
    setPressed(false);
    clearTimeout(timer.current);
  };

  return (
    <button
      type="button"
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onClick={() => onPress(label)}
      style={{
        height: "var(--keypad-key-height)",
        borderRadius: "var(--radius-keypad-key)",
        border: 0,
        background: pressed ? "var(--primary-fill)" : muted ? "var(--surface-2)" : "var(--surface-3)",
        color: pressed ? "var(--primary-on-fill)" : muted ? "var(--text-secondary)" : "var(--text-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize,
        fontWeight: 500,
        fontVariantNumeric: "tabular-nums",
        transform: pressed ? "scale(var(--press-scale))" : "scale(1)",
        transition: "transform var(--duration-fast) var(--ease-spring-snappy), background var(--duration-micro) linear",
      }}
    >
      {label === "backspace" ? <Icon name="backspace" size={iconSize} strokeWidth={1.8} /> : label}
    </button>
  );
}

/** Región visualmente oculta pero anunciada — el patrón estándar de "sr-only" para `aria-live`. */
export const VISUALLY_HIDDEN_STYLE = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;
