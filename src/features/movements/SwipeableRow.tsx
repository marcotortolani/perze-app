"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useDrag } from "@use-gesture/react";
import { Icon } from "@/design-system";

const REVEAL_THRESHOLD = 96;
const COMMIT_THRESHOLD = 160;

export interface SwipeableRowProps {
  children: ReactNode;
  onSwipeLeftCommit?: (() => void) | undefined;
  onSwipeRightCommit?: (() => void) | undefined;
  onLongPress?: (() => void) | undefined;
  disabled?: boolean | undefined;
}

/**
 * D1 — swipe izquierda = borrar, swipe derecha = editar. Resistencia hasta
 * `REVEAL_THRESHOLD` (recién ahí se ve la acción), commit inmediato al
 * soltar más allá de `COMMIT_THRESHOLD` — el equivalente por tap vive en
 * el detalle (D3), esto es puro atajo.
 */
export function SwipeableRow({ children, onSwipeLeftCommit, onSwipeRightCommit, onLongPress, disabled = false }: SwipeableRowProps) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const bind = useDrag(
    ({ down, movement: [mx], last, cancel }) => {
      if (disabled) return;
      if (down && Math.abs(mx) > 12) clearTimeout(longPressTimer.current);
      if (!last) {
        setDragging(down);
        setDx(mx);
        return;
      }
      setDragging(false);
      if (mx <= -COMMIT_THRESHOLD && onSwipeLeftCommit) {
        onSwipeLeftCommit();
        cancel();
      } else if (mx >= COMMIT_THRESHOLD && onSwipeRightCommit) {
        onSwipeRightCommit();
        cancel();
      }
      setDx(0);
    },
    { axis: "x", filterTaps: true }
  );

  const showDelete = dx < -8;
  const showEdit = dx > 8;
  const revealProgress = Math.min(Math.abs(dx) / REVEAL_THRESHOLD, 1);

  return (
    <div
      style={{ position: "relative", overflow: "hidden" }}
      onPointerDown={() => {
        longPressTimer.current = setTimeout(() => onLongPress?.(), 500);
      }}
      onPointerUp={() => clearTimeout(longPressTimer.current)}
      onPointerLeave={() => clearTimeout(longPressTimer.current)}
    >
      {showDelete ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 16, opacity: revealProgress }}>
          <Icon name="trash" size={20} color="var(--critical)" />
        </div>
      ) : null}
      {showEdit ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", paddingLeft: 16, opacity: revealProgress }}>
          <Icon name="edit" size={20} color="var(--primary-ink)" />
        </div>
      ) : null}
      <div
        {...bind()}
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : "transform var(--duration-fast) var(--ease-spring-snappy)",
          touchAction: "pan-y",
          // Opaco solo mientras se desliza (para tapar los íconos de
          // borrar/editar de abajo) — en reposo (`dx === 0`) transparente,
          // igual que `DragRow` (`/accounts`) con `active`. Antes era
          // `var(--page)` incondicional: pintaba un rectángulo sólido
          // detrás de CADA fila todo el tiempo, no solo durante el gesto.
          background: dragging || dx !== 0 ? "var(--page)" : "transparent",
        }}
      >
        {children}
      </div>
    </div>
  );
}
