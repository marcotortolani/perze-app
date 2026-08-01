"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Icon, type IconName } from "./Icon";

export interface IconButtonProps {
  icon: IconName;
  /** Obligatorio: sin texto visible, el label es la única forma de que un lector de pantalla anuncie qué hace. */
  ariaLabel: string;
  onClick: () => void;
  size?: number | undefined;
  iconSize?: number | undefined;
  color?: string | undefined;
  disabled?: boolean | undefined;
  style?: CSSProperties | undefined;
}

/**
 * D15/auditoría: 17 botones solo-ícono (volver, cerrar, descartar) medían
 * ~28px de target real (`padding: 4, margin: -4` alrededor de un ícono de
 * 22px) — bien debajo de los 44×44 que el propio sistema exige
 * (`docs/02-design-system.md` § 1, "Nada que requiera precisión"). Cada
 * pantalla lo reimplementaba a mano con un tamaño distinto. Acá el target
 * de toque siempre es 44×44 (o `size`, si hace falta más), centrado sobre
 * el ícono visual — el ícono no crece, solo el área que lo rodea.
 */
export function IconButton({ icon, ariaLabel, onClick, size = 44, iconSize = 22, color = "var(--text-secondary)", disabled = false, style }: IconButtonProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "none",
        border: 0,
        borderRadius: "50%",
        padding: 0,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transform: pressed && !disabled ? "scale(var(--press-scale))" : "scale(1)",
        transition: "transform var(--duration-fast) var(--ease-spring-snappy)",
        ...style,
      }}
    >
      <Icon name={icon} size={iconSize} color={color} />
    </button>
  );
}
