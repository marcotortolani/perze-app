"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "motion/react";
import { Amount, type AmountProps } from "@/design-system/money/Amount";
import { money, roundHalfEven } from "@/lib/money/money";
import { exceptionDuration } from "@/lib/motion/springs";
import { useMotionIntensity } from "./use-motion-intensity";

/**
 * CON-07 (docs/plan-de-trabajo.md § 4): la interpolación NUNCA pasa el
 * monto en sí por `Number()` — eso pierde precisión pasado
 * `Number.MAX_SAFE_INTEGER` (~9·10^15 unidades mínimas), silenciosamente,
 * igual que le pasaría a cualquier otro cálculo de plata. Lo que SÍ es un
 * `number` es el progreso de la animación (un 0..1 de Motion, nunca un
 * monto) — se escala a bigint con esta precisión fija y se aplica con
 * `roundHalfEven`, el mismo redondeo bancario que usa el resto de `lib/money`.
 */
const PROGRESS_SCALE = 1_000_000n;

export function interpolateAmount(from: bigint, to: bigint, progress: number): bigint {
  const diff = to - from;
  const numerator = BigInt(Math.round(progress * Number(PROGRESS_SCALE)));
  return from + roundHalfEven(diff * numerator, PROGRESS_SCALE);
}

export interface CountUpProps extends Omit<AmountProps, "value"> {
  /** Monto final — bigint en unidades mínimas. */
  value: bigint;
  currency: string;
}

/**
 * Cifra con odómetro: count-up de 400ms `easeOutExpo`, ancho estable —
 * única excepción documentada de duración junto al resto (no bloqueante:
 * el valor final ya está en el DOM desde el frame 1 para quien no anima).
 */
export function CountUp({ value, currency, ...amountProps }: CountUpProps) {
  const intensity = useMotionIntensity();
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    const prev = previous.current;
    previous.current = value;
    if (intensity !== "full" || prev === value) return;

    // 0 → 1 es el progreso de la animación, no el monto — `animate()` solo
    // ve este ratio, nunca `prev`/`value` en bigint.
    const controls = animate(0, 1, {
      duration: exceptionDuration.countUp / 1000,
      ease: [0.16, 1, 0.3, 1], // easeOutExpo
      onUpdate: (progress) => setDisplay(interpolateAmount(prev, value, progress)),
    });
    return () => controls.stop();
  }, [value, intensity]);

  const shown = intensity === "full" ? display : value;
  return <Amount value={money(shown, currency)} {...amountProps} />;
}
