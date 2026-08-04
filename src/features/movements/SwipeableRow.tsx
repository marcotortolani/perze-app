"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useDrag } from "@use-gesture/react";
import { Icon } from "@/design-system";

const REVEAL_THRESHOLD = 96;
const COMMIT_THRESHOLD = 160;
/** Cuánto dura la confirmación destructiva antes de cancelarse sola. */
const CONFIRM_AUTO_CANCEL_MS = 4000;
/** Umbral bajo a propósito: en confirmación, cualquier intención de deslizar hacia la derecha cancela — no hace falta llegar al `COMMIT_THRESHOLD` de editar. */
const CONFIRM_CANCEL_THRESHOLD = 24;

export interface SwipeableRowProps {
  children: ReactNode;
  onSwipeLeftCommit?: (() => void) | undefined;
  onSwipeRightCommit?: (() => void) | undefined;
  onLongPress?: (() => void) | undefined;
  disabled?: boolean | undefined;
  /** "¿Borrar movimiento?" — requerido junto con `onSwipeLeftCommit`. */
  confirmLabel?: string | undefined;
  /** "Borrar" — requerido junto con `onSwipeLeftCommit`. */
  confirmActionLabel?: string | undefined;
}

/**
 * D1 — swipe izquierda = borrar, swipe derecha = editar. Resistencia hasta
 * `REVEAL_THRESHOLD` (recién ahí se ve la acción), commit inmediato al
 * soltar más allá de `COMMIT_THRESHOLD` — el equivalente por tap vive en
 * el detalle (D3), esto es puro atajo.
 *
 * El swipe izquierda NO borra directo: pasa a un estado `confirming` — la
 * fila se convierte en una confirmación destructiva (tacho + "¿Borrar
 * movimiento?" + botón "Borrar") y recién ahí `onSwipeLeftCommit` se
 * ejecuta. Se cancela con swipe inverso, tap afuera, scroll o a los 4 s.
 * El gesto es de una mano y puede dispararse sin querer — el tap
 * deliberado siempre necesitó una confirmación en otros flujos
 * destructivos del repo (ver `docs/auditoria-visual.md`); acá el paso
 * extra vive en la fila, no en un diálogo modal, así se mantiene "reversible,
 * no confirmable" para todo lo que pasa DESPUÉS (el toast de deshacer sigue
 * disparando igual que antes).
 */
export function SwipeableRow({
  children,
  onSwipeLeftCommit,
  onSwipeRightCommit,
  onLongPress,
  disabled = false,
  confirmLabel,
  confirmActionLabel,
}: SwipeableRowProps) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const autoCancelTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);

  const cancelConfirm = () => {
    clearTimeout(autoCancelTimer.current);
    setConfirming(false);
  };

  // Auto-cancel a los 4s + cancelar con tap afuera o scroll, mientras
  // `confirming` está activo.
  useEffect(() => {
    if (!confirming) return;
    autoCancelTimer.current = setTimeout(cancelConfirm, CONFIRM_AUTO_CANCEL_MS);
    const handleOutside = (e: Event) => {
      if (rootRef.current && e.target instanceof Node && rootRef.current.contains(e.target)) return;
      cancelConfirm();
    };
    document.addEventListener("pointerdown", handleOutside);
    window.addEventListener("scroll", cancelConfirm, { capture: true });
    return () => {
      clearTimeout(autoCancelTimer.current);
      document.removeEventListener("pointerdown", handleOutside);
      window.removeEventListener("scroll", cancelConfirm, { capture: true });
    };
  }, [confirming]);

  const bind = useDrag(
    ({ down, movement: [mx], last, cancel }) => {
      if (disabled) return;
      if (confirming) {
        // En confirmación, cualquier intento de swipe a la derecha cancela;
        // no se puede "reconfirmar" deslizando otra vez a la izquierda.
        if (last && mx >= CONFIRM_CANCEL_THRESHOLD) cancelConfirm();
        cancel();
        return;
      }
      if (down && Math.abs(mx) > 12) clearTimeout(longPressTimer.current);
      if (!last) {
        setDragging(down);
        setDx(mx);
        return;
      }
      setDragging(false);
      if (mx <= -COMMIT_THRESHOLD && onSwipeLeftCommit) {
        setConfirming(true);
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
      ref={rootRef}
      style={{ position: "relative", overflow: "hidden" }}
      onPointerDown={() => {
        if (confirming) return;
        longPressTimer.current = setTimeout(() => onLongPress?.(), 500);
      }}
      onPointerUp={() => clearTimeout(longPressTimer.current)}
      onPointerLeave={() => clearTimeout(longPressTimer.current)}
    >
      {confirming ? null : showDelete ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 16, opacity: revealProgress }}>
          <Icon name="trash" size={20} color="var(--critical)" />
        </div>
      ) : null}
      {confirming ? null : showEdit ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", paddingLeft: 16, opacity: revealProgress }}>
          <Icon name="edit" size={20} color="var(--primary-ink)" />
        </div>
      ) : null}
      {confirming ? (
        <div
          {...bind()}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            // Mismo alto que `TransactionRow` (padding 11px + avatar 40px):
            // la fila de confirmación no puede cambiar de tamaño o
            // desincroniza `estimateSize` del virtualizador en /transactions.
            minHeight: 40,
            padding: "11px 16px",
            background: "color-mix(in srgb, var(--critical) 12%, transparent)",
            touchAction: "pan-y",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <Icon name="trash" size={20} color="var(--critical)" />
            <span style={{ fontSize: 14, color: "var(--critical)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{confirmLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              cancelConfirm();
              onSwipeLeftCommit?.();
            }}
            style={{
              flexShrink: 0,
              minHeight: 44,
              minWidth: 44,
              padding: "0 16px",
              background: "transparent",
              border: 0,
              borderRadius: "var(--radius-chip)",
              color: "var(--critical)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {confirmActionLabel}
          </button>
        </div>
      ) : (
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
      )}
    </div>
  );
}
