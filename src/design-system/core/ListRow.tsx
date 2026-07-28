"use client";

import { useState } from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface ListRowProps {
  label: string;
  /** Segunda línea, tamaño label, muted. */
  meta?: string | undefined;
  /** Valor actual alineado a la derecha (variant "value"). Pasar un `<Amount>` para plata. */
  value?: ReactNode | undefined;
  icon?: IconName | undefined;
  /** navigation = empuja una pantalla (chevron); value = muestra el valor actual de un ajuste; action = el label mismo es la acción, en tinta de marca. */
  variant?: "navigation" | "value" | "action" | undefined;
  /** Por defecto true para filas navigation. */
  chevron?: boolean | undefined;
  /** Control final, p. ej. un Switch. Si está presente la fila es un div clickeable, nunca un botón. */
  right?: ReactNode | undefined;
  destructive?: boolean | undefined;
  disabled?: boolean | undefined;
  onClick?: (() => void) | undefined;
  style?: CSSProperties | undefined;
}

/** Fila de lista genérica de 56px: ícono, label, meta, valor, control final, chevron. Sin separadores entre filas. */
export function ListRow({
  label,
  meta,
  value,
  icon,
  variant = "navigation",
  chevron,
  right,
  destructive = false,
  disabled = false,
  onClick,
  style,
}: ListRowProps) {
  const [pressed, setPressed] = useState(false);
  const showChevron = chevron ?? variant === "navigation";
  const interactive = !!onClick && !disabled;
  // Con un control propio a la derecha (Switch) la fila NO puede ser <button>: un botón no
  // puede contener contenido interactivo. En ese caso la fila es un div clickeable.
  const asButton = interactive && !right;
  const Tag: ElementType = asButton ? "button" : "div";
  const labelColor = disabled
    ? "var(--text-muted)"
    : destructive
      ? "var(--critical)"
      : variant === "action"
        ? "var(--primary-ink)"
        : "var(--text-primary)";

  return (
    <Tag
      type={asButton ? "button" : undefined}
      onClick={interactive ? onClick : undefined}
      disabled={asButton ? disabled : undefined}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        minHeight: 56,
        padding: "8px 0",
        background: "none",
        border: 0,
        textAlign: "left",
        cursor: interactive ? "pointer" : "default",
        opacity: disabled ? 0.4 : 1,
        transform: pressed && interactive ? "scale(var(--press-scale))" : "scale(1)",
        transition: "transform var(--duration-fast) var(--ease-spring-snappy)",
        ...style,
      }}
    >
      {icon ? (
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "var(--surface-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={19} color={destructive ? "var(--critical)" : "var(--text-secondary)"} />
        </span>
      ) : null}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            font: "400 16px/22px var(--font-sans)",
            color: labelColor,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        {meta ? (
          <span style={{ display: "block", font: "500 13px/18px var(--font-sans)", color: "var(--text-muted)", marginTop: 1 }}>
            {meta}
          </span>
        ) : null}
      </span>
      {value != null ? (
        <span style={{ font: "500 16px/22px var(--font-sans)", color: "var(--text-secondary)", flexShrink: 0 }}>{value}</span>
      ) : null}
      {right}
      {showChevron ? <Icon name="chevron" size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} /> : null}
    </Tag>
  );
}
