"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Envoltorio de rutas interceptadas (`/add`, `/accounts/new`,
 * `/transactions/[id]` en mobile) — URL propia, back nativo. `router.back()`
 * cierra volviendo a donde estaba, sin re-fetch de la pantalla de abajo (a
 * diferencia de `router.push('/')`).
 *
 * `background: var(--page)` es a propósito, aunque algunas pantallas
 * envueltas (las que usan `ScreenShell`) ya pintan la suya propia: sin
 * esto acá, una pantalla que vive normalmente DENTRO de `(app)/layout.tsx`
 * (como el detalle de movimiento, sin `ScreenShell` porque asume el fondo
 * del shell) queda transparente al interceptarse — en mobile, `children` y
 * `detail` se apilan en el mismo DOM (`transactions/layout.tsx`), así que
 * sin fondo sólido el texto de la lista de atrás se ve encimado con el del
 * modal. `overflowY: auto` porque el contenido interceptado no siempre
 * trae su propio scroll (`ScreenShell` tampoco lo pone) y acá sí puede
 * superar el alto del viewport.
 */
export function Modal({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", background: "var(--page)", overflowY: "auto", overscrollBehavior: "contain" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) router.back();
      }}
    >
      {children}
    </div>
  );
}
