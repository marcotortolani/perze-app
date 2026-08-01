"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Icon, type IconName } from "../core/Icon";

export interface CategoryBubbleProps {
  icon?: IconName | undefined;
  label: string;
  /** Seleccionado = superficie 3 con un anillo animado — nunca relleno de marca: elegir una categoría es elegir una opción, no identidad de datos. */
  selected?: boolean | undefined;
  onClick?: (() => void) | undefined;
  style?: CSSProperties | undefined;
}

/** Target de categoría de 64px con ícono neutro y label debajo — la selección se resuelve por superficie. */
export function CategoryBubble({ icon = "cart", label, selected = false, onClick, style }: CategoryBubbleProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        background: "none",
        border: 0,
        padding: 0,
        cursor: "pointer",
        transform: pressed ? "scale(var(--press-scale))" : "scale(1)",
        transition: "transform var(--duration-fast) var(--ease-spring-snappy)",
        ...style,
      }}
    >
      <span
        style={{
          width: 64,
          height: 64,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: selected ? "var(--selection-surface)" : "var(--surface-2)",
          border: `2px solid ${selected ? "var(--selection-ring)" : "transparent"}`,
          transform: selected ? "scale(1.04)" : "scale(1)",
          transition:
            "border-color var(--duration-fast) var(--ease-spring-snappy), background var(--duration-fast) linear, transform var(--duration-fast) var(--ease-spring-snappy)",
        }}
      >
        <Icon name={icon} size={26} color={selected ? "var(--text-primary)" : "var(--text-secondary)"} />
      </span>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500, color: selected ? "var(--text-primary)" : "var(--text-secondary)" }}>
        {label}
      </span>
    </button>
  );
}
