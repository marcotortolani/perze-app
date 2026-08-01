"use client";

import { useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { normalizeSize } from "../core/size";

/**
 * CON-11 (docs/plan-de-trabajo.md § 4, audit D04/D17): `SplitBar` pintaba
 * sus partes con `--data-1..5` — la paleta de identidad de datos, y
 * `charts.css` la prohíbe textualmente sobre un control arrastrable (I9
 * quedaba con violeta de marca dentro de un riel de allocation). Un split
 * no es una serie de datos con identidad propia entre pantallas (a
 * diferencia de "gastos de supermercado" en un gráfico, que siempre es el
 * mismo color): es proporción momentánea de ESTE control. La rampa
 * secuencial violeta (`docs/02-design-system.md` § 2.7, ya pensada para
 * magnitud/orden, no para identidad de categoría) es el token correcto.
 */
const PARTS_RAMP = [
  "var(--violet-250)",
  "var(--violet-350)",
  "var(--violet-450)",
  "var(--violet-550)",
  "var(--violet-650)",
];

export interface SplitPart {
  label: string;
  value: number;
  /** Por defecto, un paso fijo de la rampa según su índice. */
  color?: string | undefined;
}

export interface SplitBarProps {
  parts: SplitPart[];
  /** Arrastrar un límite reequilibra las dos partes adyacentes. */
  onChange?: ((parts: SplitPart[]) => void) | undefined;
  height?: number | string | undefined;
  /** Agarradera visible en cada límite arrastrable — 44px de hit-area, target táctil real. */
  showThumb?: boolean | undefined;
  /** Porcentaje debajo de cada label — apagalo si el caller ya lo muestra aparte. */
  showValues?: boolean | undefined;
  /**
   * Redondeo del valor final al soltar, en unidades de `value` (ej. 1 =
   * entero). Evita que arrastrar dé restos como 33.333...% que después no
   * suman exacto — el reparto real en `Money` lo hace `splitEvenly` al
   * confirmar, esto es solo la proporción de UI.
   */
  tolerance?: number | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Barra dividida arrastrable para repartir un monto entre miembros del
 * household o categorías. Las proporciones son de UI (0-100%); el
 * consumidor las traduce a `Money` exacto con `splitEvenly`/
 * `scaleByFraction` de `lib/money` recién al confirmar.
 */
export function SplitBar({
  parts = [],
  onChange,
  height = 12,
  showThumb = true,
  showValues = true,
  tolerance = 1,
  style,
}: SplitBarProps) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const barRef = useRef<HTMLDivElement>(null);
  const dragIdx = useRef<number | null>(null);

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragIdx.current === null || !onChange || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const i = dragIdx.current;
    const current = parts[i];
    const next = parts[i + 1];
    if (!current || !next) return;
    const before = parts.slice(0, i).reduce((s, p) => s + p.value, 0) / total;
    const pairShare = (current.value + next.value) / total;
    const nextShare = Math.min(pairShare, Math.max(0, ratio - before));
    const copy = parts.map((p) => ({ ...p }));
    const copyCurrent = copy[i];
    const copyNext = copy[i + 1];
    if (!copyCurrent || !copyNext) return;
    const rawCurrent = nextShare * total;
    copyCurrent.value = Math.round(rawCurrent / tolerance) * tolerance;
    copyNext.value = Math.round((current.value + next.value - copyCurrent.value) / tolerance) * tolerance;
    onChange(copy);
  };

  const boundaries: number[] = [];
  let acc = 0;
  for (const p of parts.slice(0, -1)) {
    acc += p.value;
    boundaries.push(acc / total);
  }

  return (
    <div style={style}>
      <div
        ref={barRef}
        onPointerMove={move}
        onPointerUp={() => {
          dragIdx.current = null;
        }}
        style={{ position: "relative", display: "flex", gap: 2, height: normalizeSize(height), borderRadius: 999, overflow: "hidden", touchAction: "none" }}
      >
        {parts.map((p, i) => (
          <div
            key={p.label}
            style={{
              width: `${(p.value / total) * 100}%`,
              background: p.color ?? PARTS_RAMP[i % PARTS_RAMP.length],
              cursor: i < parts.length - 1 && onChange ? "ew-resize" : "default",
            }}
            onPointerDown={() => {
              if (i < parts.length - 1) dragIdx.current = i;
            }}
          />
        ))}
      </div>
      {showThumb && onChange
        ? boundaries.map((b, i) => (
            <div
              key={i}
              style={{
                position: "relative",
                width: 44,
                height: 44,
                marginTop: -28,
                marginLeft: `calc(${b * 100}% - 22px)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "ew-resize",
                touchAction: "none",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  width: 4,
                  height: 20,
                  borderRadius: 999,
                  background: "var(--surface-1)",
                  boxShadow: "0 0 0 1px var(--border)",
                  pointerEvents: "auto",
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  dragIdx.current = i;
                }}
              />
            </div>
          ))
        : null}
      {showValues ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 12 }}>
          {parts.map((p, i) => (
            <span key={p.label} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--text-secondary)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color ?? PARTS_RAMP[i % PARTS_RAMP.length] }} />
              {p.label}
              <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>
                {Math.round((p.value / total) * 100)}%
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
