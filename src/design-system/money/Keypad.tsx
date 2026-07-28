"use client";

import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";

const KEYS = [
  ["1", "2", "3", "+"],
  ["4", "5", "6", "−"],
  ["7", "8", "9", "×"],
  [",", "0", "backspace", "÷"],
];
const OPS = ["+", "−", "×", "÷"];

interface KeyProps {
  label: string;
  onPress: (key: string) => void;
  onLongPress?: (() => void) | undefined;
}

function Key({ label, onPress, onLongPress }: KeyProps) {
  const [pressed, setPressed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isOp = OPS.includes(label);

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
        background: pressed ? "var(--primary-fill)" : isOp ? "var(--surface-2)" : "var(--surface-3)",
        color: pressed ? "var(--primary-on-fill)" : isOp ? "var(--text-secondary)" : "var(--text-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: isOp ? 22 : 32,
        fontWeight: 500,
        fontVariantNumeric: "tabular-nums",
        transform: pressed ? "scale(var(--press-scale))" : "scale(1)",
        transition: "transform var(--duration-fast) var(--ease-spring-snappy), background var(--duration-micro) linear",
      }}
    >
      {label === "backspace" ? <Icon name="backspace" size={24} strokeWidth={1.8} /> : label}
    </button>
  );
}

export interface KeypadProps {
  /** Recibe '0'-'9', ',', '+', '−', '×', '÷' o 'backspace'. */
  onKey: (key: string) => void;
  /** Long-press en backspace limpia toda la entrada. */
  onClear?: (() => void) | undefined;
  gap?: number | undefined;
  style?: CSSProperties | undefined;
}

/** Teclado numérico de pantalla completa — el componente más usado de la app. Teclas 64px, dígitos 32px, haptic de 8ms por tecla. */
export function Keypad({ onKey, onClear, gap = 8, style }: KeypadProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap, ...style }}>
      {KEYS.flat().map((k) => (
        <Key key={k} label={k} onPress={onKey} onLongPress={k === "backspace" ? onClear : undefined} />
      ))}
    </div>
  );
}
