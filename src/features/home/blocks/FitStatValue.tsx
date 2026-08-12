"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { fitScale } from "@/design-system";

/**
 * Mismo clamp que `Amount`'s `fit` (`ResizeObserver` + `fitScale`, mismo
 * piso de legibilidad), pero para las cifras compactas de los `StatTile`
 * de "gastado"/"ingresado este período" — pasan por `formatAmountCompact`
 * (ya abrevia, "$ 1,2 M"), no por `<Amount>`, así que `fit` no aplica
 * directo: acá el tamaño nominal es el mismo 30px que ya usa `StatTile`
 * tamaño `md`, no uno de los tokens de `size` de `Amount`.
 */
export function FitStatValue({ text }: { text: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const measure = () => {
      const naturalWidth = inner.scrollWidth / scale;
      setScale((prev) => fitScale(outer.clientWidth, naturalWidth, prev));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [scale, text]);

  return (
    <div ref={outerRef} style={{ width: "100%", overflow: "hidden" }}>
      <span
        ref={innerRef}
        style={{ display: "inline-block", whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontSize: `calc(30px * ${scale})`, lineHeight: `calc(36px * ${scale})` }}
      >
        {text}
      </span>
    </div>
  );
}
