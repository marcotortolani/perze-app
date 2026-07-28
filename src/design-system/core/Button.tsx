"use client";

import { useState } from "react";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

const base: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--space-2)",
  width: "100%",
  border: 0,
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
  fontWeight: 600,
  fontSize: 17,
  lineHeight: 1,
  borderRadius: "var(--radius-button)",
  transition: "transform var(--duration-fast) var(--ease-spring-snappy), background var(--duration-fast) linear",
};

const variants: Record<NonNullable<ButtonProps["variant"]>, CSSProperties> = {
  primary: { background: "var(--primary-fill)", color: "var(--primary-on-fill)" },
  secondary: { background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border)" },
  ghost: { background: "transparent", color: "var(--primary-ink)" },
  danger: { background: "transparent", color: "var(--critical)", border: "1px solid var(--border)" },
};

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style" | "size" | "onClick"> {
  /** primary = la única acción primaria por pantalla. */
  variant?: "primary" | "secondary" | "ghost" | "danger" | undefined;
  /** md = 56px (default), lg = 64px, sm = 44px (el piso duro de touch). */
  size?: "md" | "lg" | "sm" | undefined;
  icon?: IconName | undefined;
  children?: ReactNode | undefined;
  disabled?: boolean | undefined;
  /** Ancho completo por defecto; false para ubicaciones inline/secundarias. */
  fullWidth?: boolean | undefined;
  onClick?: (() => void) | undefined;
  style?: CSSProperties | undefined;
}

/** Botón de acción — 56-64px de alto, ancho completo, vive en los últimos 200px (zona del pulgar). */
export function Button({
  variant = "primary",
  size = "md",
  icon,
  children,
  disabled,
  fullWidth = true,
  onClick,
  style,
  ...rest
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const height = size === "lg" ? "var(--primary-button-height-lg)" : size === "sm" ? 44 : "var(--primary-button-height)";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        ...base,
        ...variants[variant],
        height,
        width: fullWidth ? "100%" : "auto",
        padding: fullWidth ? 0 : "0 20px",
        fontSize: size === "sm" ? 15 : 17,
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? "none" : "auto",
        transform: pressed ? "scale(var(--press-scale))" : "scale(1)",
        ...style,
      }}
      {...rest}
    >
      {icon ? <Icon name={icon} size={size === "sm" ? 18 : 20} strokeWidth={1.75} /> : null}
      {children}
    </button>
  );
}
