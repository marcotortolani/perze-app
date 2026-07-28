"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "backspace"];

export interface PinKeypadProps {
  /** Cuántos dígitos lleva el PIN — para los puntos de progreso. */
  length: number;
  maxLength?: number | undefined;
  onKey: (key: string) => void;
  style?: CSSProperties | undefined;
}

/**
 * Variante del `Keypad` para el gate de PIN (L6): sin operadores ni coma,
 * con puntos de progreso arriba en vez de un display de monto. El
 * `Keypad` del sistema no sirve para un PIN — no tiene sentido mostrar
 * `+ − × ÷` para cargar 4-6 dígitos secretos.
 */
export function PinKeypad({ length, maxLength = 6, onKey, style }: PinKeypadProps) {
  const [pressed, setPressed] = useState<string | null>(null);

  return (
    <div style={style}>
      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 32 }}>
        {Array.from({ length: maxLength }, (_, i) => (
          <span
            key={i}
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: i < length ? "var(--primary-fill)" : "var(--surface-3)",
              transition: "background var(--duration-fast) var(--ease-spring-snappy)",
            }}
          />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {KEYS.map((k, i) =>
          k === "" ? (
            <span key={i} />
          ) : (
            <button
              key={k}
              type="button"
              onPointerDown={() => {
                setPressed(k);
                if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
              }}
              onPointerUp={() => setPressed(null)}
              onPointerLeave={() => setPressed(null)}
              onClick={() => onKey(k)}
              style={{
                height: "var(--keypad-key-height)",
                borderRadius: "var(--radius-keypad-key)",
                border: 0,
                background: pressed === k ? "var(--primary-fill)" : "var(--surface-3)",
                color: pressed === k ? "var(--primary-on-fill)" : "var(--text-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: 26,
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
                transform: pressed === k ? "scale(var(--press-scale))" : "scale(1)",
                transition: "transform var(--duration-fast) var(--ease-spring-snappy), background var(--duration-micro) linear",
              }}
            >
              {k === "backspace" ? <Icon name="backspace" size={22} strokeWidth={1.8} /> : k}
            </button>
          )
        )}
      </div>
    </div>
  );
}
