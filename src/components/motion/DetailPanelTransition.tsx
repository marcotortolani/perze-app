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
 * `mode="sync"`: el panel saliente y el entrante se animan a la vez, en el
 * mismo track del grid. **No es `mode="wait"`** — lo era hasta que un bug
 * real lo descartó: con `wait`, si por lo que sea el salto de una selección
 * a otra no dispara correctamente el evento de fin de salida (encontrado en
 * uso real navegando rápido entre cuentas — `/accounts?account=A` →
 * `/transactions` → volver → elegir B mostraba el header actualizado a B
 * pero el cuerpo del panel se quedaba trabado en el contenido de A,
 * indefinidamente, no un parpadeo), `AnimatePresence` nunca monta el panel
 * nuevo porque literalmente está esperando a que el viejo termine de salir.
 * Un dato desactualizado permanente es mucho peor que el defecto que
 * `wait` evitaba (un estirón de layout a mitad de camino, porque el
 * detalle de dos registros rara vez mide lo mismo de alto) — así que gana
 * la opción que no puede quedar colgada. La salida sigue siendo un tween
 * corto (`micro`, 120ms) en vez de un spring: un spring de salida no tiene
 * duración acotada y acá sí la necesita. La entrada sí es spring
 * (`default`), la curva del sistema para cards y listas. El total queda
 * holgado por debajo de los 320ms que `docs/02-design-system.md` § 5.1 pone
 * como techo de una transición de interfaz.
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
    <AnimatePresence mode="sync" initial={false}>
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
