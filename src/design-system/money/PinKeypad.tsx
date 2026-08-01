"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { KeypadKey, VISUALLY_HIDDEN_STYLE } from "./KeypadKey";

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
 *
 * CON-12: anuncia "N de M dígitos" por `aria-live` — nunca el dígito en sí
 * (escribir un PIN no puede revelar el valor, solo el progreso).
 */
export function PinKeypad({ length, maxLength = 6, onKey, style }: PinKeypadProps) {
  const t = useTranslations();

  return (
    <div style={style}>
      <div role="status" aria-live="polite" style={VISUALLY_HIDDEN_STYLE}>
        {t("pinKeypad.progress", { current: length, total: maxLength })}
      </div>
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
          k === "" ? <span key={i} /> : <KeypadKey key={k} label={k} fontSize={26} iconSize={22} onPress={onKey} ariaLabel={k === "backspace" ? t("ds.keypad.backspace") : undefined} />
        )}
      </div>
    </div>
  );
}
