"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/design-system/core/Icon";

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
 * `createPortal(..., document.body)`: en mobile este componente se monta
 * como hijo del slot `detail` dentro de `.app-shell-main`/`.app-shell`
 * (`transactions/layout.tsx`, `accounts/layout.tsx`) — cualquier ancestro
 * con `transform`, `filter` o `contain` (o que Tailwind/una librería le
 * agregue después) convierte este `position: fixed` en relativo a ESE
 * ancestro en vez de al viewport, y el overlay termina recortado o
 * apilado en el lugar equivocado en vez de cubrir la pantalla entera. El
 * portal lo saca de ese árbol. Sin guardia de montaje (a diferencia de un
 * portal que pudiera aparecer en el render inicial de servidor): `Modal`
 * solo se monta al interceptar una navegación blanda ya en el cliente
 * (`@modal/(.)add`, `@detail/(.)[id]`), nunca en el árbol que SSR envía —
 * mismo criterio que `Overlay` (`src/design-system/core/Overlay.tsx`),
 * que tampoco lo necesita.
 *
 * `contained`: esas mismas pantallas (sin `ScreenShell`) tampoco traen su
 * propio padding lateral ni el ancho máximo centrado que les da
 * `(app)/layout.tsx` normalmente — interceptadas sin esto quedaban
 * pegadas borde a borde, ocupando el 100% del viewport sin control. Las
 * que sí usan `ScreenShell` (`/add`, `/accounts/new`) ya se centran solas
 * y quedan con `contained` en false (default) para no duplicar el padding.
 *
 * `contained` también dibuja su propio botón de volver: el `AppHeader`
 * único del shell (`(app)/layout.tsx`) queda tapado debajo de este overlay
 * (`z-index: 50`), así que las pantallas de detalle interceptadas —que
 * registran su `onBack` ahí vía `usePageHeader`, asumiendo que ese header
 * siempre está visible— quedaban sin ninguna forma de volver en mobile
 * salvo el gesto de swipe del sistema. Las pantallas con `ScreenShell`
 * (`contained` en false) no lo necesitan: traen su propio header.
 */
export function Modal({ children, contained = false }: { children: ReactNode; contained?: boolean }) {
  const router = useRouter();
  const t = useTranslations();

  const overlay = (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", background: "var(--page)", overflowY: "auto", overscrollBehavior: "contain" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) router.back();
      }}
    >
      {contained ? (
        <>
          <div style={{ display: "flex", alignItems: "center", height: "var(--header-height)", paddingTop: "var(--safe-top)", paddingInline: "var(--screen-padding)", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => router.back()}
              aria-label={t("ds.appHeader.back")}
              style={{ width: 44, height: 44, marginLeft: -12, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: 0, cursor: "pointer" }}
            >
              <Icon name="chevron-left" size={22} color="var(--text-secondary)" />
            </button>
          </div>
          <div style={{ width: "100%", maxWidth: "var(--content-max-width)", margin: "0 auto", paddingInline: "var(--screen-padding)", paddingBottom: "var(--safe-bottom)" }}>{children}</div>
        </>
      ) : (
        children
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
