"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { fitScale, FIT_FLOOR } from "../money/Amount";

export interface StatTileProps {
  /** Nivel caption, uppercase. */
  label: string;
  /** La cifra. Pasar un `<Amount>` o un string ya formateado. */
  value: ReactNode;
  /** Delta con signo y flecha, p. ej. "↑ 4,2%". */
  delta?: ReactNode | undefined;
  deltaPolarity?: "positive" | "negative" | "neutral" | undefined;
  /** Contexto de comparación, p. ej. "vs. junio". */
  deltaNote?: ReactNode | undefined;
  /**
   * `compact` (title 22) es lo que devuelve H1/I2 cuando necesitan tres
   * niveles tipográficos en pantalla en vez de dos — mitigación del
   * presupuesto de ruido pedida antes de escribir H1 (auditoría visual).
   */
  size?: "md" | "compact" | undefined;
  /**
   * Encoge la cifra en vez de dejarla pasar a una segunda línea — mismo
   * mecanismo que `fit` de `Amount` (medición vía `ResizeObserver`,
   * `font-size` real, nunca `transform:scale()`). Default `false`: la
   * mayoría de los tiles tienen de sobra su ancho fijo; se activa donde el
   * tile comparte fila con otro de ancho variable (analytics: patrimonio
   * neto 60% / tasa de ahorro 40%) y un monto largo puede no entrar.
   */
  fit?: boolean | undefined;
  style?: CSSProperties | undefined;
}

/** Tile de KPI: label en caption, cifra héroe, delta con signo. Sin borde, sin ícono. */
export function StatTile({ label, value, delta, deltaPolarity = "neutral", deltaNote, size = "md", fit = false, style }: StatTileProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  const color =
    deltaPolarity === "positive" ? "var(--money-positive)" : deltaPolarity === "negative" ? "var(--money-negative-emphasis)" : "var(--text-secondary)";
  const valueSize = size === "compact" ? 22 : 30;
  const valueLine = size === "compact" ? "28px" : "36px";

  useLayoutEffect(() => {
    if (!fit) return;
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const measure = () => {
      const containerWidth = outer.clientWidth;
      const naturalWidth = inner.scrollWidth / scale;
      setScale((prev) => fitScale(containerWidth, naturalWidth, prev, FIT_FLOOR));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    return () => observer.disconnect();
    // `value` es un dep real, no solo para conformar la regla: sin él, si
    // el número cambia (p. ej. el patrimonio se actualiza) sin que cambien
    // `fit`/`scale`, la medición queda vieja — a diferencia de `Amount`,
    // acá `value` puede ser cualquier `ReactNode`, así que no hay piezas
    // más chicas (como su `intFormatted`/`fracPart`) para depender en su
    // lugar.
  }, [fit, scale, value]);

  return (
    <div style={style}>
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 11,
          lineHeight: "16px",
          fontWeight: 600,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </div>
      <div ref={outerRef} style={{ marginTop: 6, minWidth: 0, overflow: fit ? "hidden" : undefined }}>
        <span
          ref={innerRef}
          style={{
            display: fit ? "inline-block" : undefined,
            fontFamily: "var(--font-sans)",
            fontSize: fit ? `calc(${valueSize}px * ${scale})` : valueSize,
            lineHeight: fit ? `calc(${valueLine} * ${scale})` : valueLine,
            fontWeight: 600,
            letterSpacing: "-.015em",
            color: "var(--text-primary)",
            whiteSpace: fit ? "nowrap" : undefined,
          }}
        >
          {value}
        </span>
      </div>
      {delta || deltaNote ? (
        <div style={{ fontSize: 13, lineHeight: "18px", marginTop: 4, color: "var(--text-secondary)" }}>
          {delta ? <span style={{ color }}>{delta}</span> : null}
          {delta && deltaNote ? " " : ""}
          {deltaNote}
        </div>
      ) : null}
    </div>
  );
}
