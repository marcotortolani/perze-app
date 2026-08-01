"use client";

import { useSyncExternalStore } from "react";

/**
 * Único corte de navegación (sidebar/TabBar, clases `lg:` de Tailwind):
 * 1024px. El split de dos columnas de `/transactions` y `/accounts` usa un
 * segundo umbral más ancho, `SPLIT_BREAKPOINT`, porque a 1024px el sidebar
 * (248px) más el panel de detalle (420px) no dejan lugar para una lista
 * legible — ver `docs/plan-de-trabajo.md` / auditoría responsive.
 * `useSyncExternalStore` en vez de `useState`+`useEffect` porque esto es
 * exactamente "leer un valor de una fuente externa (`matchMedia`)", el caso
 * que React documenta para ese hook.
 */
export const DESKTOP_BREAKPOINT = 1024;
export const SPLIT_BREAKPOINT = 1280;

export function useIsDesktop(breakpointPx = DESKTOP_BREAKPOINT): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(`(min-width: ${breakpointPx}px)`);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(`(min-width: ${breakpointPx}px)`).matches,
    () => false
  );
}
