"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/design-system/core/Icon";
import { useMotionIntensity } from "@/components/motion";

/** Mismo `--duration-base` que `Overlay` (`src/design-system/core/Overlay.tsx`) — la otra primitiva de portal a `document.body` de la app, misma sensación de "hoja que entra". */
const TRANSITION_MS = 240;

const ModalCloseContext = createContext<(() => void) | null>(null);

/**
 * El `onClose`/`onCancel` que `CaptureFlow`/`AccountFormFlow` reciben desde
 * cada `page.tsx` interceptado llama a esto en vez de `router.back()`
 * directo — si no, la salida animada de `Modal` (ver más abajo) solo
 * corre para el backdrop y el botón `contained`, y guardar/cancelar desde
 * ADENTRO del flujo (que es el cierre más común) sigue desapareciendo de
 * golpe. Fallback a `router.back()` solo por si algún consumidor viejo
 * quedara fuera del árbol de `Modal` — no debería pasar nunca en uso normal.
 */
export function useModalClose(): () => void {
  const ctx = useContext(ModalCloseContext);
  const router = useRouter();
  return ctx ?? (() => router.back());
}

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
 * `accounts/page.tsx`), así que sin fondo sólido el texto de la lista de
 * atrás se ve encimado con el del modal. `overflowY: auto` porque el
 * contenido interceptado no siempre trae su propio scroll (`ScreenShell`
 * tampoco lo pone) y acá sí puede superar el alto del viewport.
 *
 * `createPortal(..., document.body)`: en mobile este componente se monta
 * como hijo del slot `detail` dentro de `.app-shell-main`/`.app-shell`
 * (`transactions/layout.tsx`, `accounts/page.tsx`) — cualquier ancestro
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
  const pathname = usePathname();
  const t = useTranslations();
  const intensity = useMotionIntensity();
  const duration = intensity === "minimal" ? 0 : TRANSITION_MS;

  // Mismo problema que resolvía `Overlay` antes de su máquina de fases: sin
  // esto la pantalla interceptada aparecía de golpe (montaba ya en su
  // posición final) y `router.back()` la desmontaba en el mismo frame, sin
  // nada que animar. Acá no hay una prop `open` que gobernar (esto vive
  // detrás de una ruta interceptora, no de un booleano) — el estado de
  // "entrando"/"saliendo" lo lleva este componente solo, entre el montaje y
  // el momento en que algo pide cerrar.
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  // El efecto de reset va atado a `pathname`, no a `[]` (solo-al-montar):
  // Next reutiliza a veces el mismo fiber de `Modal` entre una apertura de
  // esta ruta interceptada y la siguiente — cerrar y volver a tocar el "+"
  // no siempre desmonta y remonta de verdad (cache de segmentos/back
  // instantáneo del router). Con `[]`, la segunda apertura heredaba
  // `closing: true` de la vez anterior y el panel quedaba trabado con
  // `translateY(100%)` — visible en el DOM pero empujado fuera de la
  // pantalla, sin ninguna animación que lo trajera de vuelta. Atarlo a
  // `pathname` fuerza el reset cada vez que la URL vuelve a apuntar acá,
  // sea el mismo fiber o uno nuevo — `setVisible(false)` primero para que
  // incluso un fiber reusado (que ya estaba en `visible: true`) vuelva a
  // pasar por el estado de partida antes del frame que lo anima a `true`.
  useEffect(() => {
    // Sincronización genuina con `pathname`, no derivable del render: es
    // justo la reapertura de esta ruta (mismo fiber o no) la que hay que
    // resetear, y eso solo se sabe DESPUÉS de que `pathname` cambió —
    // mismo criterio que el reset de `dragY` al abrir en `Overlay.tsx`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClosing(false);
    setVisible(false);
    let entered = false;
    const raf = requestAnimationFrame(() => {
      entered = true;
      setVisible(true);
    });
    // Red de contención: si la pestaña queda oculta justo al abrir (la app
    // vuelve de background, se abre desde una notificación con la pantalla
    // recién encendida), el navegador suspende `requestAnimationFrame` del
    // todo hasta volver a primer plano — sin esto el panel quedaría
    // invisible indefinidamente en vez de solo tarde. `setTimeout` no se
    // suspende igual (como mucho se clampa a ~1s en pestañas ocultas), así
    // que sirve de red sin competir con el camino normal — `entered` evita
    // el trabajo doble cuando el rAF sí llegó a tiempo.
    const timeout = setTimeout(() => {
      if (!entered) setVisible(true);
    }, 50);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [pathname]);

  // `router.back()` real se retrasa `duration` — tiempo para que el panel
  // termine de deslizarse afuera antes de que Next desmonte el slot
  // interceptado. El gesto de swipe-back del sistema (o el botón físico de
  // Android) no pasa por acá y cierra sin animar: es el mismo límite que
  // documenta `Overlay` para cualquier cierre que no dispare el propio JS.
  function close() {
    if (duration === 0) {
      router.back();
      return;
    }
    setClosing(true);
    setTimeout(() => router.back(), duration);
  }

  const shown = visible && !closing;
  const transform = `translateY(${shown ? "0" : "100%"})`;
  const transition = `transform ${duration}ms var(--ease-spring-snappy)`;

  const overlay = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        background: "var(--page)",
        overflowY: "auto",
        overscrollBehavior: "contain",
        transform,
        transition,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {contained ? (
        <>
          <div style={{ display: "flex", alignItems: "center", height: "var(--header-height)", paddingTop: "var(--safe-top)", paddingInline: "var(--screen-padding)", flexShrink: 0 }}>
            <button
              type="button"
              onClick={close}
              aria-label={t("ds.appHeader.back")}
              style={{ width: 44, height: 44, marginLeft: -12, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: 0, cursor: "pointer" }}
            >
              <Icon name="chevron-left" size={22} color="var(--text-secondary)" />
            </button>
          </div>
          <div style={{ width: "100%", maxWidth: "var(--content-max-width)", margin: "0 auto", paddingInline: "var(--screen-padding)", paddingBottom: "var(--safe-bottom)" }}>
            <ModalCloseContext.Provider value={close}>{children}</ModalCloseContext.Provider>
          </div>
        </>
      ) : (
        <ModalCloseContext.Provider value={close}>{children}</ModalCloseContext.Provider>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
