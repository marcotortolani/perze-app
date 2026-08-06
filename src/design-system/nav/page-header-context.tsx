"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";

export interface PageHeaderConfig {
  title?: string;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
}

/**
 * Único puente entre una página y el `AppHeader` que vive en
 * `(app)/layout.tsx` — la página nunca renderiza el header, solo declara
 * qué le corresponde mostrar (título, volver, slot extra), igual que
 * `generateMetadata` para el `<title>` del documento, pero para UI
 * interactiva que sí necesita handlers.
 */
export const PageHeaderContext = createContext<(config: PageHeaderConfig | null) => void>(() => {});

/**
 * Comparación superficial de dos configs. La usa el proveedor
 * (`(app)/layout.tsx`) para no cambiar de estado cuando lo que llega es
 * equivalente a lo que ya había.
 *
 * Funciona porque `usePageHeader` pasa SIEMPRE el mismo `onBack` por
 * consumidor (ver abajo): comparar la identidad de una arrow recreada en
 * cada render nunca daría igual y esto no serviría de nada.
 */
export function samePageHeaderConfig(a: PageHeaderConfig | null, b: PageHeaderConfig | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.title === b.title && a.backLabel === b.backLabel && a.right === b.right && a.onBack === b.onBack;
}

/**
 * Sin dependencias en el efecto, a propósito, y esto NO es un descuido: el
 * registro tiene que volver a correr en cada render por dos motivos
 * distintos.
 *
 * 1. Si `title` llega async (el nombre de una cuenta que todavía carga),
 *    cada render registra el config actualizado.
 * 2. **Dos consumidores montados a la vez se pisan, y el orden importa.**
 *    En el master-detail de escritorio la lista registra su título y el
 *    detalle su botón de volver; gana el último efecto en correr, que es
 *    el del detalle porque va después en el JSX. Cuando el detalle se
 *    desmonta, lo único que devuelve el header a su estado de lista es que
 *    la lista vuelva a registrarse en el render siguiente. Con un array de
 *    dependencias eso no pasaría y el header quedaría con el botón de
 *    volver de un detalle que ya no existe.
 *
 * Tampoco hay cleanup al desmontar, también a propósito: en una transición
 * de ruta el efecto de la página NUEVA puede correr antes o después del
 * cleanup de la vieja, y un cleanup que pone `null` puede pisar el header
 * recién puesto.
 *
 * Lo que sí se arregló: llamar al `setState` del padre con un objeto
 * literal nuevo en cada render hacía que el árbol entero volviera a
 * renderizar en cada render, y que eso no terminara en "Maximum update
 * depth exceeded" dependía de un bail-out de React —el que hace cuando el
 * elemento `children` es referencialmente idéntico—. Un wrapper sin
 * `useMemo` en el medio alcanzaba para romperlo. Ahora el efecto sigue
 * corriendo siempre, pero el proveedor descarta lo que es equivalente
 * (`samePageHeaderConfig`) y el `onBack` que se le pasa es estable por
 * consumidor: una función que lee la última versión desde un ref, así que
 * su identidad no cambia entre renders y tampoco arrastra closures viejas.
 */
export interface UsePageHeaderOptions {
  /**
   * `false` suprime el registro de ESTE render sin dejar de llamar al
   * hook (las reglas de hooks lo exigen siempre invocado). Existe para el
   * caso en que dos consumidores compiten por el mismo header con un
   * tercero fuera de los dos que decide cuál manda — p. ej. el overview de
   * un portfolio, que se sigue re-renderizando solo (el refresco de
   * precios en vivo) mientras el detalle de una posición está abierto al
   * lado en split de escritorio. Sin este freno, "gana el último efecto
   * en correr" deja de ser el DETALLE en cuanto el overview se
   * re-renderiza por su cuenta después del mount inicial — el título
   * vuelve a saltar al del portfolio aunque la selección siga viva. El
   * contenedor (`page.tsx`) es quien sabe cuándo corresponde ceder.
   */
  enabled?: boolean;
}

export function usePageHeader(config: PageHeaderConfig, options?: UsePageHeaderOptions): void {
  const setConfig = useContext(PageHeaderContext);
  const enabled = options?.enabled ?? true;

  const onBackRef = useRef(config.onBack);
  // En un efecto y no durante el render: escribir un ref mientras se
  // renderiza es un efecto secundario en fase de render. Acá no corre
  // riesgo de quedar viejo porque nadie lee el ref durante ese render —
  // solo se lee cuando el usuario toca el botón, mucho después.
  useLayoutEffect(() => {
    onBackRef.current = config.onBack;
  });
  const stableOnBack = useCallback(() => onBackRef.current?.(), []);

  useLayoutEffect(() => {
    if (!enabled) return;
    setConfig({
      ...(config.title !== undefined ? { title: config.title } : {}),
      ...(config.backLabel !== undefined ? { backLabel: config.backLabel } : {}),
      ...(config.right !== undefined ? { right: config.right } : {}),
      ...(config.onBack ? { onBack: stableOnBack } : {}),
    });
  });
}
