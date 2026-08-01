"use client";

import type { CSSProperties } from "react";
import { useMotionIntensity } from "../../components/motion/use-motion-intensity";

export interface ZMarkProps {
  size?: number | undefined;
  gap?: number | undefined;
  /** Loader del splash: mismo dibujo, en secuencia. Estática en estados vacíos. */
  animated?: boolean | undefined;
  style?: CSSProperties | undefined;
}

/** Rejilla 3×3 con forma de Z: al 20%/28% de tinta como marca en vacíos, animada como loader. */
const CELLS = [1, 1, 1, 0, 1, 0, 1, 1, 1];
const STAGGER_MS = 120;

export function ZMark({ size = 20, gap = 6, animated = false, style }: ZMarkProps) {
  // Con "Movimiento: mínima" la animación se apaga y queda estática (contrato § ZMark).
  const intensity = useMotionIntensity();
  const effectiveAnimated = animated && intensity !== "minimal";
  let step = 0;
  return (
    <div
      role="img"
      aria-label="PERZE"
      aria-busy={effectiveAnimated || undefined}
      style={{ display: "grid", gridTemplateColumns: `repeat(3, ${size}px)`, gap, ...style }}
    >
      {CELLS.map((filled, i) => {
        const delay = filled ? step++ * STAGGER_MS : 0;
        return (
          <span
            key={i}
            style={{
              width: size,
              height: size,
              borderRadius: Math.round(size / 4),
              background: filled ? "var(--zmark-ink)" : "transparent",
              animation: filled && effectiveAnimated ? `zpulse 1.4s ease-in-out ${delay}ms infinite` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
