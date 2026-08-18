"use client";

import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Icon, type IconName } from "../core/Icon";

export interface CategoryBubbleProps {
  icon?: IconName | undefined;
  label: string;
  /** Seleccionado = superficie 3 con un anillo animado — nunca relleno de marca: elegir una categoría es elegir una opción, no identidad de datos. */
  selected?: boolean | undefined;
  onClick?: (() => void) | undefined;
  /** Mantener presionado ~500ms — el picker de categorías lo usa para desplegar subcategorías sin gastar un tap extra. Si dispara, el `onClick` de ese mismo gesto se suprime (nunca los dos a la vez). */
  onLongPress?: (() => void) | undefined;
  /** Punto violeta en la esquina — indica que hay subcategorías detrás de un long-press, antes de que el usuario tenga que descubrirlo por accidente. */
  hasChildren?: boolean | undefined;
  style?: CSSProperties | undefined;
}

/** Target de categoría de 64px con ícono neutro y label debajo — la selección se resuelve por superficie. */
export function CategoryBubble({ icon = "cart", label, selected = false, onClick, onLongPress, hasChildren = false, style }: CategoryBubbleProps) {
  const [pressed, setPressed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressFired = useRef(false);

  const down = () => {
    setPressed(true);
    if (onLongPress) {
      timer.current = setTimeout(() => {
        longPressFired.current = true;
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
        onLongPress();
        // El propio `onLongPress` puede reemplazar el árbol entero (el
        // picker de categorías abre la vista de subcategorías) — este
        // botón se desmonta antes de que el dedo se levante, así que el
        // `click` nativo del mismo gesto cae sobre lo que haya quedado
        // debajo, en la vista NUEVA, y esa burbuja recibía la selección
        // sin que el usuario la haya tocado. Un listener de captura de un
        // solo uso en el documento intercepta ese click fantasma sea cual
        // sea el elemento donde termine.
        if (typeof document !== "undefined") {
          const suppressGhostClick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
          };
          document.addEventListener("click", suppressGhostClick, { capture: true, once: true });
        }
      }, 500);
    }
  };
  const up = () => {
    setPressed(false);
    clearTimeout(timer.current);
  };

  return (
    <button
      type="button"
      onClick={() => {
        // El long-press de este mismo gesto ya disparó `onLongPress` — el
        // `click` nativo llega igual al soltar el dedo, y sin esto
        // seleccionaría la categoría Y la desplegaría a la vez.
        if (longPressFired.current) {
          longPressFired.current = false;
          return;
        }
        onClick?.();
      }}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        background: "none",
        border: 0,
        padding: 0,
        cursor: "pointer",
        transform: pressed ? "scale(var(--press-scale))" : "scale(1)",
        transition: "transform var(--duration-fast) var(--ease-spring-snappy)",
        // Sin esto, mantener presionado ~500ms para el long-press marca el
        // label como si fuera texto seleccionable (el navegador lo
        // interpreta como una selección larga, no como una pulsación).
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "manipulation",
        ...style,
      }}
    >
      <span
        style={{
          position: "relative",
          width: 64,
          height: 64,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: selected ? "var(--selection-surface)" : "var(--surface-2)",
          border: `2px solid ${selected ? "var(--selection-ring)" : "transparent"}`,
          transform: selected ? "scale(1.04)" : "scale(1)",
          transition:
            "border-color var(--duration-fast) var(--ease-spring-snappy), background var(--duration-fast) linear, transform var(--duration-fast) var(--ease-spring-snappy)",
        }}
      >
        <Icon name={icon} size={26} color={selected ? "var(--text-primary)" : "var(--text-secondary)"} />
        {hasChildren ? (
          // Indica que hay subcategorías detrás de un long-press — sin
          // esto, mantener presionado es una interacción invisible que
          // nadie descubre por su cuenta.
          <span
            aria-hidden="true"
            style={{ position: "absolute", top: 2, right: 2, width: 10, height: 10, borderRadius: 999, background: "var(--primary-ink)", border: "2px solid var(--page)" }}
          />
        ) : null}
      </span>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500, color: selected ? "var(--text-primary)" : "var(--text-secondary)" }}>
        {label}
      </span>
    </button>
  );
}
