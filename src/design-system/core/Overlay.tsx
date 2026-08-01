"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useIsDesktop } from "@/hooks/use-is-desktop";

export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  children: ReactNode;
}

/**
 * Primitiva de diálogo flotante — no existía ninguna en el design system
 * (`Sheet` es solo móvil, sin portal ni trampa de foco). La usa el
 * buscador (`search-overlay.tsx`); no migra `Sheet`/`Modal` a esto todavía.
 *
 * Portal a `document.body`, foco atrapado y restaurado al cerrar, Escape
 * cierra, scroll del body bloqueado mientras está abierto. Geometría:
 * anclado abajo en móvil/tablet (`<1024px`), centrado en escritorio.
 */
export function Overlay({ open, onClose, labelledBy, children }: OverlayProps) {
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
        alignItems: isDesktop ? "flex-start" : "flex-end",
        paddingTop: isDesktop ? "12vh" : 0,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        style={
          isDesktop
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
