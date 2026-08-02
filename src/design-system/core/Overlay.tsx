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
  // La mayoría de los callers pasan `onClose` como un closure inline (o
  // `Sheet` lo envuelve en `?? (() => {})`), así que es una referencia
  // nueva en cada render. Si el efecto de abajo dependiera de `onClose`
  // directo, se re-ejecutaría en CADA re-render mientras el sheet sigue
  // abierto — no solo al abrirlo — y volvería a robar el foco cada vez
  // (el bug real detrás de "seleccionar una categoría con subcategorías
  // reabre el teclado"). Guardarlo en un ref lo desacopla: el efecto
  // pesado corre una sola vez por apertura, esto se actualiza en cada
  // render sin re-disparar nada.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    const panel = panelRef.current;
    // Nunca el primer `<input>` de texto: enfocarlo de entrada levanta el
    // teclado nativo apenas se abre el sheet, sin que el usuario haya
    // tocado nada — molesto en un buscador que la mayoría de las veces se
    // usa tocando la lista, no escribiendo. Se prefiere un control no-input
    // (botón, fila, chip); si no hay ninguno, el foco va al panel mismo
    // (`tabIndex=-1`), nunca a un input por default.
    const focusable = panel?.querySelector<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
    if (focusable) focusable.focus();
    else panel?.focus();

    const originalOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
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
  }, [open]);

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
        // Fallback de foco cuando el panel no tiene ningún control que no
        // sea un `<input>` de texto — ver el efecto de arriba.
        tabIndex={-1}
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
                // Tope duro: ningún sheet pasa el 80% del alto útil, sea
                // cual sea el `height` que le pase el caller. Con
                // `height="auto"` (el default, y lo que todo caller nuevo
                // debería usar) el panel crece con su contenido hasta acá
                // y recién ahí scrollea — un `height` fijo sigue pudiendo
                // dejar espacio vacío si el contenido es corto, este tope
                // no resuelve eso, solo el techo.
                maxHeight: "80dvh",
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
