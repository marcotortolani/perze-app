"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Amount } from "../money/Amount";
import type { Money } from "@/lib/money/money";
import { formatAmountCompact } from "@/lib/money/format";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { assignBentoSlots } from "@/lib/layout/bento";

export interface AccountSummary {
  id: string;
  institution: string;
  /** Tipo de cuenta, p. ej. "Caja de Ahorro". */
  name: string;
  balance: Money;
  country?: string | undefined;
  /**
   * CON-15: cuentas de broker en dos monedas (ej. saldo en pesos + saldo en
   * dólares de la misma cuenta) — el caller arma el segundo `<Amount>` ya
   * formateado, este componente no sabe de brokers ni decide cuándo
   * corresponde mostrarlo.
   */
  secondaryBalance?: ReactNode | undefined;
}

export interface AccountCarouselProps {
  accounts: AccountSummary[];
  activeId?: string | undefined;
  onSelect?: ((id: string) => void) | undefined;
  privacy?: boolean | undefined;
  /**
   * En desktop (`lg`, 1024px), reacomoda las cards en grid en vez de
   * carrusel — hay ancho real para mostrarlas todas juntas, sin depender de
   * un gesto de arrastre. Mobile (y cualquier caller que no lo pase, como
   * el selector de cuenta de `DetailsSheet` en captura) sigue siendo el
   * carrusel de siempre. Ver `.account-grid-lg` en `globals.css`.
   */
  gridOnDesktop?: boolean | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Carrusel horizontal con snap de cuentas: saldo, institución, moneda,
 * país. La cuenta activa se resuelve por superficie (surface-2), nunca
 * por relleno de marca.
 */
export function AccountCarousel({ accounts = [], activeId, onSelect, privacy = false, gridOnDesktop = false, style }: AccountCarouselProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = 0;
  }, []);

  // Orden y ancho final SOLO para el grid de escritorio — el carrusel de
  // mobile respeta el orden que ya trae `accounts` (ahí el orden importa
  // para el swipe), y no tiene noción de "columna". El home es un resumen,
  // no una lista donde el orden porte significado: `assignBentoSlots`
  // decide tanto la forma de la grilla (`bentoLayout`) como quién va en
  // cada slot de esa forma.
  const { gridItems: gridAccounts, gridSpans } = useMemo(() => {
    if (!gridOnDesktop) return { gridItems: accounts, gridSpans: [] as number[] };
    return assignBentoSlots(accounts, (a) => formatAmountCompact(a.balance, { showSign: false }).length);
  }, [accounts, gridOnDesktop]);
  // `gridOnDesktop` es la prop que el caller pasa (a menudo fija en
  // `true`, dejando que sea el CSS de `.account-grid-lg` el que decida el
  // layout real por breakpoint) — no basta para saber si ESTE render está
  // mostrando el grid o el carrusel: hace falta el ancho real del
  // viewport. Sin `useIsDesktop()` acá, mobile heredaba tanto el orden
  // reordenado por peso del bento como el texto "destacado" de la primera
  // card, aunque visualmente siguiera siendo un carrusel plano (D65).
  const isDesktop = useIsDesktop();
  const useGrid = gridOnDesktop && isDesktop;
  const renderedAccounts = useGrid ? gridAccounts : accounts;
  // La destacada es siempre la primera del grid armado arriba — el slot
  // más ancho de la fila 1, que por construcción recibe la cuenta de
  // mayor peso. En mobile no hay noción de "destacada": el carrusel
  // muestra todas igual.
  const featuredId = useGrid ? gridAccounts[0]?.id : undefined;

  // Click-and-drag con mouse (desktop): sin esto, un usuario sin trackpad ni
  // scroll horizontal solo podía mover el carrusel con Shift+rueda — nada
  // arrastrable a simple vista, a diferencia de cualquier carrusel nativo.
  // Solo `pointerType === "mouse"`: el touch ya scrollea nativo via
  // `overflow-x: auto` + `scroll-snap`, agregar el mismo manejo ahí
  // competiría con el gesto nativo del sistema.
  const [dragging, setDragging] = useState(false);
  const dragState = useRef({ startX: 0, startScrollLeft: 0, moved: false });

  return (
    <div
      ref={ref}
      // `account-carousel-track` lleva `display`/`overflow-x` — no pueden
      // vivir en el `style` inline de abajo: un inline style de React le
      // gana SIEMPRE a una clase, media query o no, así que `account-grid-lg`
      // nunca podría pisarlos en desktop si quedaran ahí.
      className={`account-carousel-track${gridOnDesktop ? " account-grid-lg" : ""}`}
      // Sin mouse/trackpad horizontal, un usuario de desktop con más
      // cuentas de las que entran no tenía forma de ver el resto: la
      // rueda vertical del mouse no mueve un `overflow-x: auto` solo, y el
      // scrollbar está oculto a propósito (`scrollbarWidth: none`, es el
      // look de un carrusel con snap, no el de una lista con scrollbar).
      // Traduce la rueda vertical a horizontal SOLO cuando el gesto viene
      // predominantemente en vertical (un trackpad que ya manda `deltaX`
      // sigue scrolleando nativo, sin este handler pisándolo).
      onWheel={(e) => {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        const el = ref.current;
        if (!el || el.scrollWidth <= el.clientWidth) return;
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") return;
        const el = ref.current;
        if (!el || el.scrollWidth <= el.clientWidth) return;
        dragState.current = { startX: e.clientX, startScrollLeft: el.scrollLeft, moved: false };
        setDragging(true);
        el.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        const el = ref.current;
        if (!el) return;
        const dx = e.clientX - dragState.current.startX;
        // 8px, no 2-3: un click "quieto" de mano real casi nunca es cero
        // píxeles exactos entre mousedown y mouseup — un umbral más chico
        // bloqueaba el `onClick` de la card en clicks normales, no solo en
        // arrastres de verdad.
        if (Math.abs(dx) > 8) dragState.current.moved = true;
        el.scrollLeft = dragState.current.startScrollLeft - dx;
      }}
      onPointerUp={(e) => {
        if (!dragging) return;
        setDragging(false);
        ref.current?.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => setDragging(false)}
      // Un drag real no debe además disparar el `onClick` de la cuenta que
      // quedó bajo el cursor al soltar — se frena acá, en captura, antes de
      // que llegue al botón.
      onClickCapture={(e) => {
        if (dragState.current.moved) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      style={{
        gap: 12,
        scrollSnapType: dragging ? "none" : "x mandatory",
        padding: "0 var(--screen-padding)",
        margin: "0 calc(-1 * var(--screen-padding))",
        scrollPaddingInlineStart: "var(--screen-padding)",
        scrollbarWidth: "none",
        cursor: dragging ? "grabbing" : "grab",
        userSelect: dragging ? "none" : undefined,
        ...style,
      }}
    >
      {renderedAccounts.map((a, i) => {
        const on = a.id === activeId;
        const featured = a.id === featuredId;
        return (
          <button
            key={a.id}
            type="button"
            className="account-carousel-card"
            onClick={() => onSelect?.(a.id)}
            style={{
              scrollSnapAlign: "start",
              flex: "0 0 auto",
              // El span sale de `bentoLayout()` — nunca es simplemente
              // 3/4/5, es la forma elegida de la fila que le tocó.
              gridColumn: gridOnDesktop ? `span ${gridSpans[i]}` : undefined,
              textAlign: "left",
              cursor: "pointer",
              background: on ? "var(--selection-surface)" : "var(--surface-1)",
              borderRadius: "var(--radius-card)",
              padding: 16,
              border: 0,
              boxShadow: on ? "inset 0 0 0 1px var(--selection-ring)" : "none",
              transition: "background var(--duration-fast) var(--ease-spring-snappy)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {a.institution}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)" }}>{a.balance.currency}</span>
            </div>
            <div style={{ marginTop: 10 }}>
              {/* `title` (no `hero`) en la destacada: le da jerarquía real
                  sobre el resto sin competir con la única cifra héroe de la
                  página (el patrimonio neto arriba) — el sistema pide una
                  sola por pantalla. `fit`: red de seguridad contra el
                  desborde — el ancho real de cada card depende del reparto
                  del bento y del viewport, ninguna heurística de anchos
                  puede ser exacta siempre; con `fit` la cifra se achica
                  (hasta 70% del tamaño nominal) en vez de cortarse. */}
              <Amount value={a.balance} size={featured ? "title" : "body"} showSign={false} polarity="neutral" privacy={privacy} fit fitFloor={0.7} />
              {a.secondaryBalance ? (
                <div style={{ marginTop: 2, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 13, color: "var(--text-muted)" }}>
                  {a.secondaryBalance}
                </div>
              ) : null}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a.name}
              {a.country ? ` · ${a.country}` : ""}
            </div>
          </button>
        );
      })}
    </div>
  );
}
