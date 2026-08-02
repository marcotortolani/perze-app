"use client";

import { useState } from "react";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style" | "onClick"> {
  children?: ReactNode | undefined;
  /** Los chips seleccionados llevan el relleno de marca — el único lugar donde el violeta aparece en una lista de chips. */
  selected?: boolean | undefined;
  icon?: IconName | undefined;
  onClick?: (() => void) | undefined;
  /** Trunca el label con elipsis en vez de estirar el chip — para filas de varios chips que tienen que entrar en un ancho fijo (ítem 11: 5 + "Otros" en 2 filas). El ícono nunca se recorta. */
  maxWidth?: number | string | undefined;
  style?: CSSProperties | undefined;
}

/** Píldora de 36px para filtros, atajos de gasto frecuente y opciones de scope. */
export function Chip({ children, selected = false, icon, onClick, maxWidth, style, ...rest }: ChipProps) {
  const [pressed, setPressed] = useState(false);
  const interactive = typeof onClick === "function";
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 36,
        padding: "0 14px",
        maxWidth,
        borderRadius: "var(--radius-chip)",
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
        fontSize: 13,
        lineHeight: 1,
        cursor: interactive ? "pointer" : "default",
        background: selected ? "var(--primary-fill)" : "var(--surface-2)",
        color: selected ? "var(--primary-on-fill)" : "var(--text-secondary)",
        border: selected ? "1px solid transparent" : "1px solid var(--border)",
        transform: pressed ? "scale(var(--press-scale))" : "scale(1)",
        transition: "transform var(--duration-fast) var(--ease-spring-snappy), background var(--duration-fast) linear",
        ...style,
      }}
      {...rest}
    >
      {icon ? <Icon name={icon} size={15} strokeWidth={1.75} style={{ flexShrink: 0 }} /> : null}
      {maxWidth !== undefined ? (
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{children}</span>
      ) : (
        children
      )}
    </button>
  );
}
