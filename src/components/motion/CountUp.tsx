"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "motion/react";
import { Amount, type AmountProps } from "@/design-system/money/Amount";
import { money } from "@/lib/money/money";
import { exceptionDuration } from "@/lib/motion/springs";
import { useMotionIntensity } from "./use-motion-intensity";

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

    const from = Number(prev);
    const to = Number(value);
    const controls = animate(from, to, {
      duration: exceptionDuration.countUp / 1000,
      ease: [0.16, 1, 0.3, 1], // easeOutExpo
      onUpdate: (latest) => setDisplay(BigInt(Math.round(latest))),
    });
    return () => controls.stop();
  }, [value, intensity]);

  const shown = intensity === "full" ? display : value;
  return <Amount value={money(shown, currency)} {...amountProps} />;
}
