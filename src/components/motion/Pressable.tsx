"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { spring } from "@/lib/motion/springs";
import { useHaptics, type HapticPattern } from "./use-haptics";
import { useMotionIntensity } from "./use-motion-intensity";

export interface PressableProps {
  children: ReactNode;
  onClick?: (() => void) | undefined;
  haptic?: HapticPattern | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
  disabled?: boolean | undefined;
  "aria-label"?: string | undefined;
}

/**
 * `scale(0.96)` con `spring.snappy` + haptic — en TODO lo tocable
 * (`docs/02-design-system.md` § 5.2). Respeta la intensidad de motion: en
 * "mínima" el press no escala, solo cambia de opacidad.
 */
export function Pressable({ children, onClick, haptic = "tap", className, style, disabled, ...rest }: PressableProps) {
  const vibrate = useHaptics();
  const intensity = useMotionIntensity();
  const minimal = intensity === "minimal";

  // Motion tipa `whileTap`/etc. sin aceptar `undefined` explícito bajo
  // `exactOptionalPropertyTypes` — se omite la key entera en vez de
  // asignarle `undefined` cuando está deshabilitado.
  const tapProps = disabled ? {} : { whileTap: minimal ? { opacity: 0.7 } : { scale: 0.96 } };

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        vibrate(haptic);
        onClick?.();
      }}
      {...tapProps}
      transition={spring.snappy}
      className={className}
      // El tipo interno de `style` de Motion es incompatible con
      // `exactOptionalPropertyTypes` para sus props de transform-shorthand
      // (`x`/`y`, que este botón no usa) — fricción conocida de la librería.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style={{ border: 0, background: "none", padding: 0, cursor: disabled ? "default" : "pointer", ...style } as any}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
