"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Detecta si un contenedor scrolleable (`overflowY: auto`) tiene contenido
 * real para scrollear — `scroll-fade-bottom` (`globals.css`) es un
 * `::after` puramente CSS que no puede saberlo solo: sin este hook mostraba
 * el degradado (y sugería "hay más abajo") incluso cuando el contenido
 * entraba entero, por ejemplo en `/more/settings` con pocas filas.
 *
 * `ref` es un callback ref, no un `useRef` pasivo — a propósito. Varias
 * páginas (`/accounts`, home) tienen un estado de carga (`Skeleton`) antes
 * del contenido real: con un `useRef` + `useEffect(..., [])` de toda la
 * vida, el efecto corre una sola vez al MONTAR el componente, encuentra
 * `ref.current === null` (el skeleton todavía no renderizó el scroller
 * real) y nunca se vuelve a ejecutar cuando los datos llegan y el nodo de
 * verdad aparece — el degradado quedaba pegado en "sin overflow" para
 * siempre, aunque el contenido real sí desbordara. Un callback ref sí
 * dispara cada vez que React monta el nodo, sea en el primer render o
 * varios renders después.
 *
 * Dos observers porque un disparador solo no alcanza: `ResizeObserver`
 * sobre el propio scroller capta cuando el ESPACIO disponible cambia
 * (resize de ventana, aparece/desaparece la sidebar) — pero no dispara
 * solo porque el CONTENIDO creció (el `flex:1` del scroller no cambia de
 * tamaño aunque sus hijos sí). Para eso, `MutationObserver` sobre el
 * árbol: cubre filas que se agregan/sacan (p. ej. activar "Fondo de
 * puntos" suma dos filas, o terminar de cargar la lista de cuentas) sin
 * asumir nada sobre la estructura interna del contenido (a diferencia de
 * observar "el primer hijo", que falla si el contenido son varios
 * hermanos sueltos en vez de un único wrapper). `attributes: true,
 * attributeFilter: ["style"]`: el virtualizador de `/transactions` no
 * agrega/saca nodos al filtrar, ajusta el `style.height` inline del div
 * de alto total.
 */
export function useScrollOverflow<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [overflowing, setOverflowing] = useState(false);

  const ref = useCallback((el: T | null) => {
    setNode(el);
  }, []);

  useEffect(() => {
    if (!node) return;

    const check = () => setOverflowing(node.scrollHeight - node.clientHeight > 1);
    check();

    const resizeObserver = new ResizeObserver(check);
    resizeObserver.observe(node);
    const mutationObserver = new MutationObserver(check);
    mutationObserver.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [node]);

  return { ref, overflowing };
}
