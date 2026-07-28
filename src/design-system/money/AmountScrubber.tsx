"use client";

import { useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Amount } from "./Amount";
import type { Money } from "@/lib/money/money";

interface DragState {
  x: number;
  start: bigint;
  t: number;
}

export interface AmountScrubberProps {
  value: Money;
  /** Incremento mínimo, en unidades mínimas — la velocidad del drag lo multiplica. */
  step?: bigint | undefined;
  onChange?: ((next: bigint) => void) | undefined;
  /** Un tap (sin drag) le pasa la posta al keypad. */
  onOpenKeypad?: (() => void) | undefined;
  style?: CSSProperties | undefined;
}

/** Cifra héroe arrastrable: el drag horizontal ajusta el monto con aceleración por velocidad. */
export function AmountScrubber({ value, step = 1000n, onChange, onOpenKeypad, style }: AmountScrubberProps) {
  const drag = useRef<DragState | null>(null);
  const [active, setActive] = useState(false);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, start: value.amount, t: Date.now() };
    setActive(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const velocity = Math.min(6, 1 + Math.abs(dx) / 60);
    // La física del gesto es aproximada (píxeles, velocidad) a propósito;
    // el valor final se cuantiza a `step` y se commitea como bigint acá,
    // en el único punto donde este componente produce un monto real.
    const stepNumber = Number(step);
    const candidate = Number(drag.current.start) + dx * stepNumber * velocity;
    const quantized = Math.max(0, Math.round(candidate / stepNumber)) * stepNumber;
    onChange?.(BigInt(quantized));
  };

  const onPointerUp = () => {
    const quick = drag.current !== null && Date.now() - drag.current.t < 180;
    drag.current = null;
    setActive(false);
    if (quick) onOpenKeypad?.();
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        touchAction: "none",
        cursor: "ew-resize",
        transform: active ? "scale(1.02)" : "scale(1)",
        transition: "transform var(--duration-fast) var(--ease-spring-snappy)",
        ...style,
      }}
    >
      <Amount value={value} size="hero-xl" showSign={false} mutedDecimals />
    </div>
  );
}
