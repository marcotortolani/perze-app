"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useHaptics } from "./use-haptics";
import { useMotionIntensity } from "./use-motion-intensity";

type Phase = "idle" | "morphing" | "check" | "done";

export interface MorphButtonProps {
  children: ReactNode;
  /** El guardado real (local, síncrono en la práctica: guardar no puede fallar). */
  onConfirm: () => void | Promise<void>;
  /** Se dispara cuando termina la secuencia completa (≤700ms) — ahí va el toast con Deshacer. */
  onComplete?: (() => void) | undefined;
  disabled?: boolean | undefined;
  style?: React.CSSProperties | undefined;
}

/**
 * Botón → círculo (240ms) → check dibujado con `pathLength` (200ms) →
 * `onComplete` (la card vuela a la lista y aparece el toast) —
 * `docs/02-design-system.md` § 5.2, secuencia de guardado, ≤700ms total,
 * interactivo desde el frame 1.
 */
export function MorphButton({ children, onConfirm, onComplete, disabled, style }: MorphButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const vibrate = useHaptics();
  const intensity = useMotionIntensity();
  const animated = intensity !== "minimal";

  const handleClick = async () => {
    if (phase !== "idle") return;
    setPhase("morphing");
    vibrate("success");
    await onConfirm();

    const morphMs = animated ? 240 : 0;
    const checkMs = animated ? 200 : 0;
    setTimeout(() => setPhase("check"), morphMs);
    setTimeout(() => {
      setPhase("done");
      onComplete?.();
    }, morphMs + checkMs);
  };

  const isCircle = phase !== "idle";

  return (
    <motion.button
      type="button"
      disabled={disabled || phase !== "idle"}
      onClick={handleClick}
      animate={{
        width: isCircle ? 56 : "100%",
        borderRadius: isCircle ? 999 : 16,
      }}
      transition={{ duration: 0.24, ease: [0.24, 1.05, 0.32, 1] }}
      style={{
        height: "var(--primary-button-height)",
        border: 0,
        cursor: disabled ? "default" : "pointer",
        background: "var(--primary-fill)",
        color: "var(--primary-on-fill)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        fontSize: 17,
        opacity: disabled ? 0.4 : 1,
        overflow: "hidden",
        margin: isCircle ? "0 auto" : undefined,
        ...style,
        // El tipo interno de `style` de Motion es incompatible con
        // `exactOptionalPropertyTypes` para sus props de transform-shorthand
        // (`x`/`y`, que este botón no usa) — fricción conocida de la
        // librería, no un error real acá.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any}
    >
      {phase === "idle" ? (
        children
      ) : phase === "morphing" ? null : (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <motion.path
            d="M20 6L9 17l-5-5"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          />
        </svg>
      )}
    </motion.button>
  );
}
