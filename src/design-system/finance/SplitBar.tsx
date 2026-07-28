"use client";

import { useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

const SLOTS = ["var(--data-1)", "var(--data-2)", "var(--data-3)", "var(--data-4)", "var(--data-5)"];

export interface SplitPart {
  label: string;
  value: number;
  /** Por defecto, el slot de datos fijo de su índice. */
  color?: string | undefined;
}

export interface SplitBarProps {
  parts: SplitPart[];
  /** Arrastrar un límite reequilibra las dos partes adyacentes. */
  onChange?: ((parts: SplitPart[]) => void) | undefined;
  height?: number | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Barra dividida arrastrable para repartir un monto entre miembros del
 * household o categorías. Las proporciones son de UI (0-100%); el
 * consumidor las traduce a `Money` exacto con `splitEvenly`/
 * `scaleByFraction` de `lib/money` recién al confirmar.
 */
export function SplitBar({ parts = [], onChange, height = 12, style }: SplitBarProps) {
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
    copyCurrent.value = Math.round(nextShare * total);
    copyNext.value = Math.round((pairShare - nextShare) * total);
    onChange(copy);
  };

  return (
    <div style={style}>
      <div
        ref={barRef}
        onPointerMove={move}
        onPointerUp={() => {
          dragIdx.current = null;
        }}
        style={{ display: "flex", gap: 2, height, borderRadius: 999, overflow: "hidden", touchAction: "none" }}
      >
        {parts.map((p, i) => (
          <div
            key={p.label}
            style={{
              width: `${(p.value / total) * 100}%`,
              background: p.color ?? SLOTS[i % 5],
              cursor: i < parts.length - 1 && onChange ? "ew-resize" : "default",
            }}
            onPointerDown={() => {
              if (i < parts.length - 1) dragIdx.current = i;
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 12 }}>
        {parts.map((p, i) => (
          <span key={p.label} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--text-secondary)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color ?? SLOTS[i % 5] }} />
            {p.label}
            <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>
              {Math.round((p.value / total) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
