"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { duration, spring } from "@/lib/motion/springs";
import { useMotionIntensity } from "./use-motion-intensity";

export interface DetailPanelTransitionProps {
  /** Cambia cuando cambia el contenido del panel — típicamente el id del
   *  registro seleccionado, con un valor centinela para "sin selección". */
  transitionKey: string;
  children: ReactNode;
}

/**
 * Transición de la columna de detalle en un master-detail de escritorio, al
 * pasar de un registro a otro (y al entrar/salir del estado sin selección).
 * La usan `/transactions` y `/accounts`.
 *
 * Existe porque en las dos pantallas el detalle se selecciona con un search
 * param, así que el cambio es instantáneo: sin nada que lo acompañe, el panel
 * derecho se reemplaza de golpe y se lee como un salto. Cuando el detalle era
 * una ruta interceptada esto no hacía falta, pero no porque estuviera
 * resuelto — lo tapaba la recarga de página del bug de Next
 * (vercel/next.js#91265), que no era una transición sino el defecto.
 *
 * `mode="wait"`: el panel saliente se va ANTES de que entre el nuevo. En
 * `sync` los dos se superponen en el mismo track del grid, y como el detalle
 * de dos registros rara vez mide lo mismo de alto, la columna daba un estirón
 * a mitad de camino. La contra de `wait` es que las dos mitades se suman, y
 * por eso la salida es un tween corto (`micro`, 120ms) en vez de un spring: un
 * spring de salida no tiene duración acotada y acá sí la necesita. La entrada
 * sí es spring (`default`), que es la curva del sistema para cards y listas.
 * El total queda holgado por debajo de los 320ms que
 * `docs/02-design-system.md` § 5.1 pone como techo de una transición de
 * interfaz.
 *
 * Respeta el ajuste propio de intensidad además de `prefers-reduced-motion`
 * (los dos, vía `useMotionIntensity`): `full` desplaza 8px y funde, `reduced`
 * solo funde —nada de movimiento espacial—, `minimal` no anima: el panel se
 * reemplaza seco, que es exactamente lo que pide ese ajuste.
 *
 * Es solo para el panel de escritorio. En mobile el detalle va adentro de
 * `Modal`, que trae su propia entrada y salida.
 */
export function DetailPanelTransition({ transitionKey, children }: DetailPanelTransitionProps) {
  const intensity = useMotionIntensity();
  if (intensity === "minimal") return <>{children}</>;
  const slide = intensity === "full" ? 8 : 0;

  return (
    // `initial={false}`: el primer render de la pantalla no anima. Entrar a la
    // pantalla no es "cambiar de registro", y animar ahí competiría con la
    // entrada de la lista.
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={transitionKey}
        initial={{ opacity: 0, y: slide }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: duration.micro / 1000 } }}
        transition={spring.default}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
