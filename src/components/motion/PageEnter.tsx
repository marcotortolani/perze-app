"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion, type MotionStyle } from "motion/react";
import { spring } from "@/lib/motion/springs";
import { useMotionIntensity } from "./use-motion-intensity";

export interface PageEnterProps {
  children: ReactNode;
  /** Se pasa tal cual al nodo. El default mantiene la cadena de altura que
   *  necesitan las pantallas con scroller propio; una pantalla que no la
   *  tenga puede pasar `{}`.
   *
   *  `MotionStyle` y no `CSSProperties`: con `exactOptionalPropertyTypes` las
   *  dos no son compatibles (`CSSProperties` admite `x: undefined`, que
   *  `motion` no acepta porque `x`/`y` son valores animables). */
  style?: MotionStyle;
}

/**
 * Entrada suave de una pantalla: funde y sube unos píxeles, una sola vez, al
 * montarse.
 *
 * Es la contraparte de `DetailPanelTransition` y NO se puede reemplazar por
 * ella: aquélla lleva `initial={false}` a propósito —no anima en el primer
 * render, solo al CAMBIAR de registro— que es exactamente lo contrario de lo
 * que hace falta acá. Comparten el vocabulario (fundido + desplazamiento
 * corto en `y`, misma escala de intensidad) para que se lean como el mismo
 * sistema, pero son dos gestos distintos.
 *
 * Usa `spring.soft`, que es la curva que `docs/02-design-system.md` § 5.1
 * declara para "sheets, pantallas" — más suelta que la de cards y listas, que
 * es la que corresponde a un panel de detalle.
 *
 * Anima al montarse, no en cada render, así que conviene envolver el retorno
 * CON DATOS de la pantalla y no sus estados de carga: de esa forma el gesto
 * ocurre cuando el contenido reemplaza al skeleton, que es el momento en que
 * hay algo que presentar. Envolver el skeleton también haría que la pantalla
 * animara dos veces.
 *
 * Respeta el ajuste propio de intensidad además de `prefers-reduced-motion`:
 * `full` sube 10px y funde, `reduced` solo funde, `minimal` no anima y
 * devuelve un nodo plano equivalente para no cambiar la estructura del DOM.
 */
export function PageEnter({ children, style = { height: "100%", minHeight: 0 } }: PageEnterProps) {
  const intensity = useMotionIntensity();
  if (intensity === "minimal") return <div style={style as CSSProperties}>{children}</div>;
  const slide = intensity === "full" ? 10 : 0;

  return (
    <motion.div initial={{ opacity: 0, y: slide }} animate={{ opacity: 1, y: 0 }} transition={spring.soft} style={style}>
      {children}
    </motion.div>
  );
}
