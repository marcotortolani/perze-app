"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Icon, type IconName } from "../core/Icon";

export interface OptionCardProps {
  title: string;
  description?: string | undefined;
  icon?: IconName | undefined;
  selected?: boolean | undefined;
  onClick?: (() => void) | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Opción grande seleccionable por superficie, con título y una línea —
 * A5 ("¿con quién la vas a usar?"), A8 (plantilla de categorías). Hueco
 * detectado al armar el onboarding: se estaba rearmando a mano en cada
 * pantalla.
 */
export function OptionCard({ title, description, icon, selected = false, onClick, style }: OptionCardProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        textAlign: "left",
        padding: 16,
        borderRadius: "var(--radius-card)",
        border: `1px solid ${selected ? "var(--selection-ring)" : "transparent"}`,
        background: selected ? "var(--selection-surface)" : "var(--surface-2)",
        cursor: "pointer",
        transform: pressed ? "scale(var(--press-scale))" : "scale(1)",
        transition: "transform var(--duration-fast) var(--ease-spring-snappy), background var(--duration-fast) linear",
        ...style,
      }}
    >
      {icon ? (
        <span style={{ width: 44, height: 44, borderRadius: 12, background: "var(--surface-1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name={icon} size={22} color="var(--text-secondary)" />
        </span>
      ) : null}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>{title}</span>
        {description ? <span style={{ display: "block", fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{description}</span> : null}
      </span>
    </button>
  );
}
