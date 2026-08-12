"use client";

import type { ReactNode } from "react";
import { IconButton } from "@/design-system";
import { Icon } from "@/design-system/core/Icon";

export interface DashboardBlockShellProps {
  label: string;
  dragLabel: string;
  hideLabel: string;
  onHide: () => void;
  /**
   * El sensor de teclado de `@dnd-kit` reordena DENTRO de una columna
   * (flechas arriba/abajo) pero no cruza a la otra — mismo límite por el
   * que el bento de cuentas en desktop ya resolvió su 2-D con un menú en
   * vez de solo gesto. Este botón es la vía por teclado para lo que el
   * drag entre columnas cubre con mouse/touch.
   */
  moveToOtherColumnLabel: string;
  onMoveToOtherColumn: () => void;
  /** Columna actual del bloque — decide qui chevron mostrar (hacia adónde se movería). */
  column: "left" | "right";
  /** `useSortable().listeners` — SOLO van en la asa, nunca en el resto del bloque. */
  dragHandleProps: Record<string, unknown>;
  /** `useSortable().setActivatorNodeRef` — el nodo real que hace de asa para el sensor de puntero/teclado. */
  dragHandleRef: (el: HTMLElement | null) => void;
  /** El bloque no tiene nada que mostrar ahora mismo (módulo apagado, sin datos) — placeholder en vez del bloque real. */
  unavailable?: boolean;
  unavailableLabel?: string;
  children: ReactNode;
}

/**
 * Chrome del modo edición sobre un bloque del home: franja de 44px (asa +
 * nombre + ojo) y el contenido real atenuado y con `inert` — nunca
 * clickeable mientras se está reordenando. El contorno de 1px que agrega
 * acá (`--border`) es a propósito la única excepción al "0 bordes de caja
 * evitables" del presupuesto de ruido: ese presupuesto es para la pantalla
 * por defecto, y este es un modo transitorio y explícito que el usuario
 * pidió entrar — no la lectura normal del dashboard.
 */
export function DashboardBlockShell({
  label,
  dragLabel,
  hideLabel,
  onHide,
  moveToOtherColumnLabel,
  onMoveToOtherColumn,
  column,
  dragHandleProps,
  dragHandleRef,
  unavailable,
  unavailableLabel,
  children,
}: DashboardBlockShellProps) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 4px", height: 44 }}>
        <button
          ref={dragHandleRef}
          type="button"
          aria-label={dragLabel}
          data-home-block-action="handle"
          {...dragHandleProps}
          style={{ width: 44, height: 44, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: 0, cursor: "grab", touchAction: "none" }}
        >
          <Icon name="list" size={18} color="var(--text-muted)" />
        </button>
        <span className="t-caption" style={{ flex: 1, minWidth: 0, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
        {/* `data-*` en un `span` que envuelve el `IconButton` — el DS no
            expone rest-props arbitrarios en sus botones, y estos atributos
            son solo un gancho estable para e2e (el aria-label de "Ocultar"
            colisiona con el toggle de privacidad, que también empieza con
            "Ocultar "). */}
        <span data-home-block-action="move-column">
          <IconButton icon={column === "left" ? "chevron" : "chevron-left"} ariaLabel={moveToOtherColumnLabel} onClick={onMoveToOtherColumn} />
        </span>
        <span data-home-block-action="hide">
          <IconButton icon="eye-off" ariaLabel={hideLabel} onClick={onHide} />
        </span>
      </div>
      <div inert style={{ opacity: 0.55, padding: "0 4px 4px", pointerEvents: "none" }}>
        {unavailable ? (
          <div style={{ padding: "16px 4px", fontSize: 13, color: "var(--text-muted)" }}>{unavailableLabel}</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
