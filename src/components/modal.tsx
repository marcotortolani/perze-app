"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Envoltorio de rutas interceptadas (`/add`, `/accounts/new`,
 * `/transactions/[id]` y `/accounts/[id]` en mobile) — URL propia, back
 * nativo. `router.back()` cierra volviendo a donde estaba, sin re-fetch de
 * la pantalla de abajo (a diferencia de `router.push('/')`).
 *
 * `background: var(--page)` es a propósito, aunque algunas pantallas
 * envueltas (las que usan `ScreenShell`) ya pintan la suya propia: sin
 * esto acá, una pantalla que vive normalmente DENTRO de `(app)/layout.tsx`
 * (como los detalles de movimiento/cuenta, sin `ScreenShell` porque asumen
 * el fondo del shell) queda transparente al interceptarse — en mobile,
 * `children` y `detail` se apilan en el mismo DOM (`transactions/layout.tsx`,
 * `accounts/layout.tsx`), así que sin fondo sólido el texto de la lista de
 * atrás se ve encimado con el del modal. `overflowY: auto` porque el
 * contenido interceptado no siempre trae su propio scroll (`ScreenShell`
 * tampoco lo pone) y acá sí puede superar el alto del viewport.
 *
 * `contained`: esas mismas pantallas (sin `ScreenShell`) tampoco traen su
 * propio padding lateral ni el ancho máximo centrado que les da
 * `(app)/layout.tsx` normalmente — interceptadas sin esto quedaban
 * pegadas borde a borde, ocupando el 100% del viewport sin control. Las
 * que sí usan `ScreenShell` (`/add`, `/accounts/new`) ya se centran solas
 * y quedan con `contained` en false (default) para no duplicar el padding.
 */
export function Modal({ children, contained = false }: { children: ReactNode; contained?: boolean }) {
  const router = useRouter();

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", background: "var(--page)", overflowY: "auto", overscrollBehavior: "contain" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) router.back();
      }}
    >
      {contained ? (
        <div style={{ width: "100%", maxWidth: "var(--content-max-width)", margin: "0 auto", paddingInline: "var(--screen-padding)", paddingTop: "var(--safe-top)" }}>{children}</div>
      ) : (
        children
      )}
    </div>
  );
}
