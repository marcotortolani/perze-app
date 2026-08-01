"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { normalizeSize } from "./size";

export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  labelledBy?: string | undefined;
  children: ReactNode;
  /**
   * D3 — `Sheet` reusa esta primitiva para el portal/trap de foco/Escape/
   * scroll lock, en vez de reimplementarlos: `"dialog"` (default) es la
   * caja centrada en escritorio / anclada abajo en móvil que ya usaba el
   * buscador; `"sheet"` es SIEMPRE bottom sheet (radio solo arriba,
   * `--shadow-sheet`, ancho completo) sea cual sea el viewport — un sheet
   * no se vuelve un diálogo centrado en desktop.
   */
  variant?: "dialog" | "sheet" | undefined;
  /** Solo con `variant="sheet"` — alto del panel, ver `normalizeSize()`. */
  height?: number | string | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Primitiva de diálogo flotante — portal a `document.body`, foco atrapado
 * y restaurado al cerrar, Escape cierra, scroll del body bloqueado
 * mientras está abierto. Sin esto cada consumidor (el buscador, y ahora
 * `Sheet`) tenía que reimplementar las cuatro cosas por separado.
 */
export function Overlay({ open, onClose, labelledBy, children, variant = "dialog", height, style }: OverlayProps) {
  const isDesktop = useIsDesktop();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>('input, button, [href], [tabindex]:not([tabindex="-1"])');
    focusable?.focus();

    const originalOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = panel.querySelectorAll<HTMLElement>('input, button, [href], [tabindex]:not([tabindex="-1"])');
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.documentElement.style.overflow = originalOverflow;
      if (previouslyFocused.current instanceof HTMLElement) previouslyFocused.current.focus();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const isSheet = variant === "sheet";

  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "var(--scrim)",
        display: "flex",
        justifyContent: "center",
        alignItems: isSheet ? "flex-end" : isDesktop ? "flex-start" : "flex-end",
        paddingTop: !isSheet && isDesktop ? "12vh" : 0,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        style={
          isSheet
            ? {
                position: "relative",
                width: "100%",
                background: "var(--surface-2)",
                borderRadius: "var(--radius-sheet) var(--radius-sheet) 0 0",
                boxShadow: "var(--shadow-sheet)",
                padding: "10px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))",
                height: normalizeSize(height ?? "auto"),
                overflow: "auto",
                ...style,
              }
            : isDesktop
              ? { width: 640, maxWidth: "92vw", maxHeight: "70dvh", background: "var(--surface-1)", borderRadius: "var(--radius-sheet)", boxShadow: "var(--shadow-sheet)", overflow: "hidden", display: "flex", flexDirection: "column" }
              : { width: "100%", maxHeight: "85dvh", background: "var(--surface-1)", borderRadius: "var(--radius-sheet) var(--radius-sheet) 0 0", boxShadow: "var(--shadow-sheet)", overflow: "hidden", display: "flex", flexDirection: "column" }
        }
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
