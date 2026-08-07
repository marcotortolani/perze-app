"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Tamaño real en píxeles de un nodo — necesario para un treemap (D73): a
 * diferencia de un bento grid (formas de columna fijas, `bento.ts`), un
 * treemap cuadrado necesita el ancho/alto REAL del contenedor para decidir
 * el layout óptimo, no un porcentaje. `ref` es un callback ref (no
 * `useRef` pasivo) por el mismo motivo que `useScrollOverflow`: dispara de
 * nuevo cuando React monta el nodo real después de un estado de carga.
 */
export function useElementSize<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const ref = useCallback((el: T | null) => {
    setNode(el);
  }, []);

  useEffect(() => {
    if (!node) return;

    const update = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    update();

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return { ref, width: size.width, height: size.height };
}
