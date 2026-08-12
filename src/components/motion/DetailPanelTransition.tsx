"use client";

import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { spring } from "@/lib/motion/springs";
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
 * **Sin `AnimatePresence`, a propósito — es la segunda vez que ese mecanismo
 * se rompe acá y las dos veces bajo el mismo gatillo.** Primero aparecía como
 * panel viejo trabado para siempre (`mode="wait"`: `/accounts`, seleccionar
 * A → navegar afuera → volver → elegir B — el header pasaba a B, el cuerpo
 * se quedaba en A). Cambiar a `mode="sync"` lo tapó ahí, pero en
 * `/transactions` el mismo gatillo (seleccionar un movimiento → navegar
 * afuera → volver, sin elegir uno nuevo) mostraba el panel viejo Y el estado
 * vacío **a la vez**, apilados — la prueba de que el nodo saliente nunca
 * llegaba a desmontarse en ninguno de los dos modos, solo cambiaba si eso se
 * notaba o no. El patrón en común: navegar afuera de la página y volver dentro
 * de la ventana de router cache de Next (`staleTimes`) no desmonta el árbol
 * de verdad — probablemente lo oculta y lo reactiva — y `AnimatePresence`
 * asume desmontaje real para poder limpiar el nodo que salió. Un `motion.div`
 * con `key={transitionKey}` **sin** `AnimatePresence` no tiene ese problema:
 * el reconciliador de React reemplaza el nodo viejo por el nuevo de forma
 * inmediata e incondicional en cuanto cambia el `key`, sin depender de que
 * ninguna animación de salida dispare ni termine. Se pierde el fundido de
 * salida del panel viejo (algo que "wait"/"sync" sí daban); se gana que la
 * columna de detalle no puede quedar en un estado inconsistente. El sistema
 * de diseño no fija un mínimo de fidelidad para esta transición puntual —
 * ver la nota en `CLAUDE.md` si en algún momento se quiere una salida animada
 * de verdad, resuelta de otra forma que no dependa de `AnimatePresence` acá.
 *
 * Respeta el ajuste propio de intensidad además de `prefers-reduced-motion`
 * (los dos, vía `useMotionIntensity`): `full` desplaza 8px y funde al
 * entrar, `reduced` solo funde —nada de movimiento espacial—, `minimal` no
 * anima: el panel se reemplaza seco, que es exactamente lo que pide ese
 * ajuste (y además es el único caso en que ya no hacía falta `motion.div`).
 *
 * Es solo para el panel de escritorio. En mobile el detalle va adentro de
 * `Modal`, que trae su propia entrada y salida.
 */
export function DetailPanelTransition({ transitionKey, children }: DetailPanelTransitionProps) {
  const intensity = useMotionIntensity();
  // `initial={false}` de motion no sirve acá (no hay `AnimatePresence` que
  // lo lea) — el equivalente manual es no animar el PRIMER `transitionKey`
  // que este componente ve, para que entrar a la pantalla no compita con la
  // entrada de la lista; los cambios de key SIGUIENTES sí animan. Ajuste de
  // estado durante el render (patrón oficial de React, no un ref: un ref
  // leído/escrito en render rompe bajo el React Compiler de este proyecto —
  // ver la nota de `capture-draft-store.tsx`), sin efecto extra ni flash.
  const [seen, setSeen] = useState({ key: transitionKey, changed: false });
  if (transitionKey !== seen.key) setSeen({ key: transitionKey, changed: true });
  const isFirstRender = !seen.changed;

  if (intensity === "minimal") return <>{children}</>;
  const slide = intensity === "full" ? 8 : 0;

  return (
    <motion.div
      key={transitionKey}
      initial={isFirstRender ? false : { opacity: 0, y: slide }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.default}
    >
      {children}
    </motion.div>
  );
}
