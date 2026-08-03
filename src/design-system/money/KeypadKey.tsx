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
  /** La tecla "=" ocupa toda la fila (`Keypad`, `gridColumn: 1 / -1`) — sin esto el botón queda del ancho de su contenido en vez de estirarse. */
  fullWidth?: boolean | undefined;
  /** Default `var(--keypad-key-height)` (64px). `AmountStep` la baja a `--primary-button-height` (56px) cuando "=" comparte fila con el botón de Siguiente/Guardar, para que las dos alturas calcen. */
  height?: string | undefined;
  /**
   * D14/auditoría: sin esto, un dígito se anuncia bien solo porque es su
   * propio texto visible, pero `backspace` (ícono sin texto) quedaba
   * completamente mudo para un lector de pantalla, y los operadores
   * (`+ − × ÷`) se anunciaban con el símbolo crudo en vez de su nombre.
   * El caller (`Keypad`/`PinKeypad`) ya tiene `useTranslations()` — pasa el
   * label traducido acá en vez de que `KeypadKey` importe next-intl.
   */
  ariaLabel?: string | undefined;
}

/**
 * CON-12 (docs/plan-de-trabajo.md § 4): `Keypad` y `PinKeypad` compartían
 * `KeypadKey` solo de palabra — cada uno tenía su propio `<button>`
 * duplicado. Comparten esto y nada más: `contrato-componentes.md` es
 * explícito en que no son una variante entre sí (valores de distinto tipo,
 * `aria-live` opuestos, modelos de error distintos) — no unificar más allá
 * de esta tecla.
 */
export function KeypadKey({ label, muted = false, fontSize = 32, iconSize = 24, onPress, onLongPress, ariaLabel, fullWidth = false, height = "var(--keypad-key-height)" }: KeypadKeyProps) {
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
      aria-label={ariaLabel}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onClick={() => onPress(label)}
      style={{
        width: fullWidth ? "100%" : undefined,
        height,
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
