"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { spring } from "@/lib/motion/springs";
import { useMotionIntensity } from "./use-motion-intensity";

export interface AnimatedBannerProps {
  show: boolean;
  children: ReactNode;
}

/**
 * Envoltorio para banners condicionales (offline, conflictos, recordatorios)
 * — el patrón `{show ? <Banner /> : null}` que ya tenían `Overlay`/`Modal`
 * antes de arreglarse: aparecían con su propia animación de montaje pero
 * desaparecían de golpe (React los saca del DOM en el mismo frame que
 * `show` pasa a `false`, sin nada que animar la salida), dejando un salto
 * de layout en todo lo que está debajo. `AnimatePresence` sí puede animar
 * la salida porque mantiene el nodo montado hasta que la transición
 * termina. `layout` en el contenedor: el resto de los banners/bloques que
 * colapsan hacia arriba lo hacen con el mismo spring, no de un salto.
 *
 * `spring.default` (cards/listas, `docs/02-design-system.md` § 5.1) — un
 * banner es contenido de lista, no un sheet ni una pantalla.
 */
export function AnimatedBanner({ show, children }: AnimatedBannerProps) {
  const intensity = useMotionIntensity();
  if (intensity === "minimal") return show ? <>{children}</> : null;

  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          layout
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={spring.default}
          style={{ overflow: "hidden", flexShrink: 0 }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
