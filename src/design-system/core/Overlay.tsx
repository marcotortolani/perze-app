"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDrag } from "@use-gesture/react";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { useMotionIntensity } from "@/components/motion/use-motion-intensity";
import { normalizeSize } from "./size";

/** Arrastrar más allá de esto (o soltar con velocidad) cierra el sheet. */
const DRAG_CLOSE_THRESHOLD = 120;
const DRAG_CLOSE_VELOCITY = 0.5;

/** `--duration-base` (240ms) — ni tan brusco como `--fast` ni tan largo como `--slow`, para una hoja que recorre toda su altura. 0 con intensidad "mínima", mismo criterio que `MorphButton`. */
const TRANSITION_MS = 240;

type Phase = "closed" | "entering" | "open" | "leaving";

export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  labelledBy?: string | undefined;
  children: ReactNode;
  /**
   * D3 — `Sheet` reusa esta primitiva para el portal/trap de foco/Escape/
   * scroll lock, en vez de reimplementarlos: `"dialog"` (default) es la
   * caja centrada en escritorio / anclada abajo en móvil que ya usaba el
   * buscador; `"sheet"` es SIEMPRE bottom sheet (radio solo arriba,
   * `--shadow-sheet`, ancho completo) sea cual sea el viewport — un sheet
   * no se vuelve un diálogo centrado en desktop.
   */
  variant?: "dialog" | "sheet" | undefined;
  /** Solo con `variant="sheet"` — alto del panel, ver `normalizeSize()`. */
  height?: number | string | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Primitiva de diálogo flotante — portal a `document.body`, foco atrapado
 * y restaurado al cerrar, Escape cierra, scroll del body bloqueado
 * mientras está abierto. Sin esto cada consumidor (el buscador, y ahora
 * `Sheet`) tenía que reimplementar las cuatro cosas por separado.
 */
export function Overlay({ open, onClose, labelledBy, children, variant = "dialog", height, style }: OverlayProps) {
  const isDesktop = useIsDesktop();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);
  const intensity = useMotionIntensity();
  const animated = intensity !== "minimal";
  const duration = animated ? TRANSITION_MS : 0;

  // Antes esto desmontaba (`if (!open) return null`) en el mismo frame en
  // que `open` pasaba a `false` — sin animación de salida posible, porque
  // no había nada que animar cuando React ya sacó el nodo del DOM. Ahora
  // "cerrado" es un estado más (`phase`), no lo mismo que `!open`: al
  // pasar a `false`, el panel sigue montado un instante en "leaving"
  // (transform hacia afuera) y recién se saca del DOM cuando termina la
  // transición. Simétrico para abrir: monta en "entering" (transform de
  // partida, sin transición) y al frame siguiente pasa a "open" (destino,
  // con transición) — dos pintados distintos son lo que el navegador
  // necesita para animar entre ellos.
  const [phase, setPhase] = useState<Phase>(open ? "open" : "closed");
  // La mayoría de los callers pasan `onClose` como un closure inline (o
  // `Sheet` lo envuelve en `?? (() => {})`), así que es una referencia
  // nueva en cada render. Si el efecto de abajo dependiera de `onClose`
  // directo, se re-ejecutaría en CADA re-render mientras el sheet sigue
  // abierto — no solo al abrirlo — y volvería a robar el foco cada vez
  // (el bug real detrás de "seleccionar una categoría con subcategorías
  // reabre el teclado"). Guardarlo en un ref lo desacopla: el efecto
  // pesado corre una sola vez por apertura, esto se actualiza en cada
  // render sin re-disparar nada.
  const onCloseRef = useRef(onClose);

  // Slide hacia abajo para cerrar — antes solo se podía tocar afuera del
  // panel. El gesto se capta en una franja angosta arriba (agarradera +
  // título de `Sheet`), no en el panel entero: si abarcara todo el
  // contenido, un swipe para scrollear una lista larga competiría con el
  // cierre. `dragY` mueve el panel entero (no solo esta franja) para que
  // se sienta como arrastrar la hoja, no un elemento suelto adentro.
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const bindDrag = useDrag(
    ({ down, movement: [, my], velocity: [, vy], direction: [, dy], last }) => {
      const clamped = Math.max(0, my);
      if (!last) {
        setDragging(down);
        setDragY(clamped);
        return;
      }
      setDragging(false);
      const shouldClose = clamped > DRAG_CLOSE_THRESHOLD || (vy > DRAG_CLOSE_VELOCITY && dy > 0);
      if (shouldClose) {
        // `dragY` queda tal cual (no se resetea a 0 acá): `onClose` dispara
        // la fase "leaving" más abajo, que anima el panel hasta afuera de
        // la pantalla — arrancando desde donde el arrastre lo dejó, para
        // que el gesto termine en un solo movimiento continuo en vez de
        // saltar a 0 y recién ahí empezar a irse.
        onCloseRef.current();
      } else {
        setDragY(0);
      }
    },
    { axis: "y", filterTaps: true }
  );
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Dispara la secuencia de entrada/salida — nunca en el primer render
  // (si `open` ya arranca en `true`, el `useState` de `phase` de arriba ya
  // lo resolvió bien: aparece asentado, no hace falta animar una apertura
  // que el usuario no vio empezar).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (open) {
      // Sincronización genuina con el prop `open`, no derivable del
      // render — es justo la transición closed→open la que hay que
      // animar, y eso solo se sabe DESPUÉS de que `open` cambió.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("entering");
      const raf = requestAnimationFrame(() => setPhase("open"));
      return () => cancelAnimationFrame(raf);
    }
    setPhase((prev) => (prev === "closed" ? "closed" : "leaving"));
  }, [open]);

  // "leaving" es transitorio: pasado `duration`, recién ahí se desmonta de
  // verdad (el `return null` de más abajo depende de `phase`, no de `open`).
  useEffect(() => {
    if (phase !== "leaving") return;
    const timeout = setTimeout(() => setPhase("closed"), duration);
    return () => clearTimeout(timeout);
  }, [phase, duration]);

  useEffect(() => {
    if (!open) return;
    // `dragY` sobreviviría de una apertura a la siguiente sin esto —
    // reabrir mostraría el panel ya corrido hacia abajo. Sincronización
    // genuina con el ciclo de vida "recién se abrió", no derivable del
    // render (el drag es un gesto, no una prop).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDragY(0);
    setDragging(false);
    previouslyFocused.current = document.activeElement;
    const panel = panelRef.current;
    // Nunca el primer `<input>` de texto: enfocarlo de entrada levanta el
    // teclado nativo apenas se abre el sheet, sin que el usuario haya
    // tocado nada — molesto en un buscador que la mayoría de las veces se
    // usa tocando la lista, no escribiendo. Se prefiere un control no-input
    // (botón, fila, chip); si no hay ninguno, el foco va al panel mismo
    // (`tabIndex=-1`), nunca a un input por default.
    const focusable = panel?.querySelector<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
    if (focusable) focusable.focus();
    else panel?.focus();

    const originalOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = panel.querySelectorAll<HTMLElement>('input, button, [href], [tabindex]:not([tabindex="-1"])');
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.documentElement.style.overflow = originalOverflow;
      if (previouslyFocused.current instanceof HTMLElement) previouslyFocused.current.focus();
    };
  }, [open]);

  if (phase === "closed" || typeof document === "undefined") return null;

  const isSheet = variant === "sheet";
  const visible = phase === "open";
  // Sin transición en el primer pintado de "entering": ese frame tiene que
  // asentarse en el estado de partida sin animar hacia él, para que recién
  // el paso a "open" (el siguiente frame) sea lo que el navegador anima.
  const backdropTransition = phase === "entering" ? "none" : `opacity ${duration}ms var(--ease-spring-snappy)`;

  // Entrar/salir desliza desde/hacia abajo (100% del propio alto — no un
  // px fijo, así funciona igual sea cual sea `height`). Mientras se
  // arrastra, el transform lo maneja el gesto solo (sin transición); fuera
  // de eso, se combina con el offset de fase — ver la nota en `bindDrag`
  // sobre por qué un cierre por arrastre no resetea `dragY` a 0 antes.
  const sheetPhaseOffset = visible ? "0%" : "100%";
  const sheetTransform = dragging ? `translateY(${dragY}px)` : `translateY(calc(${sheetPhaseOffset} + ${dragY}px))`;
  const sheetTransition = dragging || phase === "entering" ? "none" : `transform ${duration}ms var(--ease-spring-snappy)`;

  // El diálogo centrado de escritorio no desliza (no tiene agarradera ni
  // sentido de "hacia abajo") — funde y escala levemente. En mobile este
  // mismo `variant="dialog"` queda anclado abajo (`alignItems: "flex-end"`
  // arriba) — sin una traslación real un fade+scale centrado en un panel ya
  // pegado al borde inferior se siente casi estático. Mismo `duration` que
  // el desktop, solo cambia QUÉ se anima.
  const dialogTransform = isDesktop ? (visible ? "scale(1)" : "scale(0.96)") : visible ? "translateY(0)" : "translateY(24px)";
  const dialogTransition = phase === "entering" ? "none" : `transform ${duration}ms var(--ease-spring-snappy), opacity ${duration}ms var(--ease-spring-snappy)`;

  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "var(--scrim)",
        opacity: visible ? 1 : 0,
        transition: backdropTransition,
        display: "flex",
        justifyContent: "center",
        alignItems: isSheet ? "flex-end" : isDesktop ? "flex-start" : "flex-end",
        paddingTop: !isSheet && isDesktop ? "12vh" : 0,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        // Fallback de foco cuando el panel no tiene ningún control que no
        // sea un `<input>` de texto — ver el efecto de arriba.
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={
          isSheet
            ? {
                position: "relative",
                // A partir de `lg` (1024px, mismo corte que el sidebar) un
                // sheet a `width:100%` se estira a todo el ancho de un
                // monitor — 90% con un techo de 1500px, no el 100% literal.
                width: isDesktop ? "90%" : "100%",
                maxWidth: isDesktop ? 1500 : undefined,
                background: "var(--surface-2)",
                borderRadius: "var(--radius-sheet) var(--radius-sheet) 0 0",
                boxShadow: "var(--shadow-sheet)",
                padding: "10px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))",
                height: normalizeSize(height ?? "auto"),
                // Tope duro: ningún sheet pasa el 80% del alto útil, sea
                // cual sea el `height` que le pase el caller. Con
                // `height="auto"` (el default, y lo que todo caller nuevo
                // debería usar) el panel crece con su contenido hasta acá
                // y recién ahí scrollea — un `height` fijo sigue pudiendo
                // dejar espacio vacío si el contenido es corto, este tope
                // no resuelve eso, solo el techo.
                maxHeight: "80dvh",
                // `display:flex` en columna + `overflow:hidden` acá (no
                // `overflowY:auto`): la agarradera y el título de `Sheet`
                // quedan fuera de esta caja, en flujo normal, y solo el
                // contenedor de `children` que arma `Sheet` (con su propio
                // `flex:1; overflowY:auto`) scrollea. Antes el scroll vivía
                // acá mismo, así que la agarradera y el título — primeros
                // hijos del mismo contenedor — se iban con el resto del
                // contenido en vez de quedar fijos arriba.
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                transform: sheetTransform,
                transition: sheetTransition,
                ...style,
              }
            : isDesktop
              ? {
                  width: 640,
                  maxWidth: "92vw",
                  maxHeight: "70dvh",
                  background: "var(--surface-1)",
                  borderRadius: "var(--radius-sheet)",
                  boxShadow: "var(--shadow-sheet)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  opacity: visible ? 1 : 0,
                  transform: dialogTransform,
                  transition: dialogTransition,
                }
              : {
                  width: "100%",
                  maxHeight: "85dvh",
                  background: "var(--surface-1)",
                  borderRadius: "var(--radius-sheet) var(--radius-sheet) 0 0",
                  boxShadow: "var(--shadow-sheet)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  opacity: visible ? 1 : 0,
                  transform: dialogTransform,
                  transition: dialogTransition,
                }
        }
      >
        {isSheet ? (
          // Franja de arrastre — solo la agarradera + el título de `Sheet`,
          // no el contenido: si cubriera todo, un swipe para scrollear una
          // lista larga adentro del sheet competiría con el gesto de
          // cerrar. 44px como cualquier target de toque del sistema.
          <div {...bindDrag()} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 44, touchAction: "none", cursor: "grab" }} />
        ) : null}
        {children}
      </div>
    </div>,
    document.body
  );
}
