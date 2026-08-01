"use client";

import type { CSSProperties } from "react";
import { useMotionIntensity } from "../../components/motion/use-motion-intensity";

export interface ZMarkProps {
  size?: number | undefined;
  gap?: number | undefined;
  /** Loader del splash: mismo dibujo, en secuencia. Estática en estados vacíos. */
  animated?: boolean | undefined;
  /** `pulse`: opacidad con stagger (loader). `sweep`: un bloque violeta recorre la Z. */
  variant?: "pulse" | "sweep" | undefined;
  "aria-label"?: string | undefined;
  style?: CSSProperties | undefined;
}

/** Rejilla 3×3 con forma de Z: al 20%/28% de tinta como marca en vacíos, animada como loader. */
const CELLS = [1, 1, 1, 0, 1, 0, 1, 1, 1];
const STAGGER_MS = 120;
const SWEEP_SLOT_MS = 400;
const SWEEP_CYCLE_MS = SWEEP_SLOT_MS * 7;

export function ZMark({
  size = 20,
  gap = 6,
  animated = false,
  variant = "pulse",
  "aria-label": ariaLabel = "PERZE",
  style,
}: ZMarkProps) {
  // Con "Movimiento: mínima" la animación se apaga y queda estática (contrato § ZMark).
  const intensity = useMotionIntensity();
  const effectiveAnimated = animated && intensity !== "minimal";
  // "Reducida: sin stagger" (02 § 5.4): el conjunto pulsa como una sola pieza,
  // sin barrido ni violeta, en cualquiera de las dos variantes.
  const grouped = effectiveAnimated && intensity === "reduced";
  let step = 0;
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      aria-busy={effectiveAnimated || undefined}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(3, ${size}px)`,
        gap,
        animation: grouped ? "zpulse 1.4s ease-in-out infinite" : undefined,
        ...style,
      }}
    >
      {CELLS.map((filled, i) => {
        const order = filled ? step++ : 0;
        const animation =
          filled && effectiveAnimated && !grouped
            ? variant === "sweep"
              ? `zsweep ${SWEEP_CYCLE_MS}ms linear ${order * SWEEP_SLOT_MS}ms infinite`
              : `zpulse 1.4s ease-in-out ${order * STAGGER_MS}ms infinite`
            : undefined;
        return (
          <span
            key={i}
            style={{
              width: size,
              height: size,
              borderRadius: Math.round(size / 4),
              background: filled ? "var(--zmark-ink)" : "transparent",
              animation,
            }}
          />
        );
      })}
    </div>
  );
}
