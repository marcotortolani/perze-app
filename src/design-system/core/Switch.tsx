"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

export interface SwitchProps {
  checked?: boolean | undefined;
  onChange?: ((checked: boolean) => void) | undefined;
  disabled?: boolean | undefined;
  /** Label inline opcional; se omite cuando el Switch vive en un ListRow que ya lo etiqueta. */
  label?: string | undefined;
  /** Id del elemento de label, para aria-labelledby. */
  id?: string | undefined;
  style?: CSSProperties | undefined;
}

/** Toggle de 46×28 para un ajuste binario de aplicación inmediata. On = relleno de marca (estado de control, no decoración). */
export function Switch({ checked = false, onChange, disabled = false, label, id, style }: SwitchProps) {
  const [focus, setFocus] = useState(false);
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={id}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(12);
        onChange?.(!checked);
      }}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        width: 46,
        height: 28,
        borderRadius: 999,
        padding: 3,
        flexShrink: 0,
        border: 0,
        cursor: disabled ? "default" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        background: checked ? "var(--primary-fill)" : "var(--surface-3)",
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? "none" : "auto",
        outline: focus ? "2px solid var(--primary-ink)" : "none",
        outlineOffset: 2,
        transition: "background var(--duration-fast) var(--ease-spring-snappy)",
        ...style,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: checked ? "var(--primary-on-fill)" : "var(--text-muted)",
          transform: checked ? "translateX(18px)" : "translateX(0)",
          transition: "transform var(--duration-fast) var(--ease-spring-snappy)",
        }}
      />
    </button>
  );

  if (!label) return control;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 12, minHeight: "var(--touch-min)" }}>
      <span id={id} style={{ font: "400 16px/22px var(--font-sans)", color: disabled ? "var(--text-muted)" : "var(--text-primary)" }}>
        {label}
      </span>
      {control}
    </span>
  );
}
