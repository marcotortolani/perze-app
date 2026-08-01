"use client";

import { useRef, useState } from "react";
import type { CSSProperties, ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { Icon } from "../core/Icon";

export interface DragRowProps {
  id: string;
  children: ReactNode;
  /** Índice actual dentro de la lista del caller — el gesto reporta la nueva posición, no reordena solo. */
  index: number;
  onReorder?: ((fromIndex: number, toIndex: number) => void) | undefined;
  /** Alto de cada fila, para calcular a cuántas posiciones equivale el desplazamiento vertical. */
  rowHeight?: number | undefined;
  /** Requerido — lo resuelve el caller vía `useTranslations` (ej. "Reordenar {name}"). */
  dragLabel: string;
  style?: CSSProperties | undefined;
}

/** LIB-13: fila reordenable con asa de 44px — el drag vertical mueve de a una posición por `rowHeight` recorrido. */
export function DragRow({ id, children, index, onReorder, rowHeight = 56, dragLabel, style }: DragRowProps) {
  const drag = useRef<{ y: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const [active, setActive] = useState(false);

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    drag.current = { y: e.clientY };
    setActive(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    setOffset(e.clientY - drag.current.y);
  };

  const onPointerUp = () => {
    if (drag.current && Math.abs(offset) >= rowHeight / 2) {
      const delta = Math.round(offset / rowHeight);
      onReorder?.(index, Math.max(0, index + delta));
    }
    drag.current = null;
    setActive(false);
    setOffset(0);
  };

  return (
    <div
      data-drag-row-id={id}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        transform: `translateY(${offset}px)`,
        transition: active ? "none" : "transform var(--duration-fast) var(--ease-spring-snappy)",
        zIndex: active ? 1 : "auto",
        position: "relative",
        background: active ? "var(--surface-1)" : "transparent",
        ...style,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      <button
        type="button"
        aria-label={dragLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          width: 44,
          height: 44,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "none",
          border: 0,
          cursor: "grab",
          touchAction: "none",
        }}
      >
        <Icon name="list" size={18} color="var(--text-muted)" />
      </button>
    </div>
  );
}
