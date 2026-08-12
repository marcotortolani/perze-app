"use client";

import { useEffect, useRef, useState } from "react";
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
 * se sostiene un instante (260ms) → `onComplete` (la card vuela a la
 * lista y aparece el toast) y vuelve a "idle" — `docs/02-design-system.md`
 * § 5.2, secuencia de guardado, ≤700ms total (240+200+260), interactivo
 * desde el frame 1.
 *
 * Reutilizable: antes el botón no volvía nunca a "idle" — quedaba
 * `disabled` mostrando el tilde para siempre, y solo se "recuperaba" si el
 * componente se desmontaba. En la edición de un movimiento
 * (`EditTransactionFlow`) el cierre es un `router.back()` asíncrono que no
 * siempre desmonta la pantalla (entrada directa por URL, deep link, PWA
 * shortcut), así que una segunda edición seguida se encontraba con el
 * tilde de la primera. En modo ráfaga (`CaptureFlow`, C8) el botón ni
 * siquiera se desmonta entre cargas — `resetForBurst()` reinicia el draft
 * pero no el componente — así que sin este fix solo se podía guardar una
 * vez por ráfaga.
 */
export function MorphButton({ children, onConfirm, onComplete, disabled, style }: MorphButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const vibrate = useHaptics();
  const intensity = useMotionIntensity();
  const animated = intensity !== "minimal";
  const timeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
      timeoutIds.current.forEach(clearTimeout);
    },
    []
  );

  const handleClick = async () => {
    if (phase !== "idle") return;
    setPhase("morphing");
    vibrate("success");
    try {
      await onConfirm();
    } catch (error) {
      // Un guardado que falla no puede dejar el botón muerto en
      // "morphing" — el usuario tiene que poder reintentar. El error
      // sigue subiendo: este botón no decide cómo se comunica la falla,
      // solo se cuida de no quedar inutilizable después de una.
      if (mountedRef.current) setPhase("idle");
      throw error;
    }

    const morphMs = animated ? 240 : 0;
    const checkMs = animated ? 200 : 0;
    const holdMs = animated ? 260 : 0;

    timeoutIds.current.push(
      setTimeout(() => {
        if (mountedRef.current) setPhase("check");
      }, morphMs)
    );
    timeoutIds.current.push(
      setTimeout(() => {
        if (mountedRef.current) setPhase("done");
        onComplete?.();
      }, morphMs + checkMs)
    );
    // Timeout aparte del anterior (no el mismo tick): si "done" y "idle"
    // se setearan en la misma llamada, React los batchea y "done" nunca
    // llega a pintarse — el tilde desaparecería antes de que nadie lo vea.
    timeoutIds.current.push(
      setTimeout(() => {
        if (mountedRef.current) setPhase("idle");
      }, morphMs + checkMs + holdMs)
    );
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
