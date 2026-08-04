"use client";

import type { CSSProperties, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useIsDesktop, SPLIT_BREAKPOINT } from "@/hooks/use-is-desktop";
import { useScrollOverflow } from "@/hooks/use-scroll-overflow";
import { AccountsListContent } from "./AccountsListContent";

/** `/accounts/<uuid>` exacto — nunca matchea `/accounts`, `/accounts/new` ni subrutas con más segmentos (`reconcile`, `card`, etc.). */
const DETAIL_ID_PATTERN = /^\/accounts\/([0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12})$/i;

function SplitGrid({ left, right, overflowing, detailScrollerRef }: { left: ReactNode; right: ReactNode; overflowing: boolean; detailScrollerRef: (node: HTMLDivElement | null) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(340px,504px)", gap: 32, height: "100%", minHeight: 0 }}>
      <div style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>{left}</div>
      {/* `paddingRight`: sin esto la barra de scroll de esta columna queda pegada contra el borde del contenido — ver la misma nota en `transactions/layout.tsx`.
          `minWidth: 0`: sin esto el ítem de grid vale `min-width: auto` y su
          ancho intrínseco (una cifra héroe larga, el chart) podía forzarlo
          más ancho que el track — y `overflow-y: auto` sin un `overflow-x`
          explícito activa `overflow-x: auto` implícito por regla de CSSOM
          (spec de `overflow`), de ahí el scroll horizontal. `overflowX:
          hidden` lo cierra del todo: el contenido de esta columna siempre
          tiene que entrar en su ancho. Tope subido un 20% (420 → 504). */}
      {/* `scroll-fade-bottom` en un wrapper propio (no en el scroller): el
          scroller de abajo ya tiene `overflowY:auto` sin `position:relative`
          propio, pero el patrón se mantiene igual que en accounts/page.tsx —
          el fade necesita un contenedor no-scrolleable como containing
          block. `paddingBottom: 32` adentro del scroller: aire real al
          final para el fade, mismo criterio que el resto. */}
      <div className="scroll-fade-bottom" data-scroll-overflow={overflowing} style={{ "--scroll-fade-inset-right": "12px", minWidth: 0, maxWidth: 504, minHeight: 0 } as CSSProperties}>
        <div
          ref={detailScrollerRef}
          style={{
            minWidth: 0,
            height: "100%",
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            overscrollBehavior: "contain",
            borderLeft: "1px solid var(--border)",
            paddingLeft: 32,
            paddingRight: 12,
            paddingBottom: 32,
          }}
        >
          {right}
        </div>
      </div>
    </div>
  );
}

/**
 * E1/E2 en dos columnas de escritorio — mismo patrón que `transactions/layout.tsx`, ver esa nota.
 *
 * Caso especial: un hard-reload (o un link externo, o pegar la URL) de
 * `/accounts/<id>` NO pasa por la ruta interceptora `@detail/(.)[id]` —
 * Next.js solo intercepta navegaciones que ocurren desde adentro de la app
 * (`router.push` con la lista ya montada). En un hard-reload, `children`
 * pasa a ser directamente el contenido de `accounts/[id]/page.tsx` (el
 * DETALLE, no la lista) y `@detail` cae a su `default.tsx` (el
 * placeholder "Elegí una cuenta..."). Sin este caso especial, en desktop
 * el detalle terminaba ocupando la columna de la lista con el placeholder
 * vacío al lado, y en mobile aparecían los dos apilados a la vez. Se
 * detecta por `pathname` (ningún slot puede saberlo por sí solo) y se arma
 * la lista a mano con `AccountsListContent`, ignorando el slot `detail`
 * (que en este caso no tiene nada útil).
 */
export default function AccountsLayout({ children, detail }: { children: ReactNode; detail: ReactNode }) {
  const isSplit = useIsDesktop(SPLIT_BREAKPOINT);
  const pathname = usePathname();
  const { ref: detailScrollerRef, overflowing } = useScrollOverflow<HTMLDivElement>();

  const hardNavId = pathname.match(DETAIL_ID_PATTERN)?.[1];

  if (hardNavId) {
    // Mobile: mostrar el placeholder de `@detail` apilado debajo del
    // detalle real no tiene sentido acá — no hubo ninguna interceptación,
    // así que ese slot no dice nada útil.
    if (!isSplit) return <>{children}</>;
    return <SplitGrid left={<AccountsListContent activeId={hardNavId} />} right={children} overflowing={overflowing} detailScrollerRef={detailScrollerRef} />;
  }

  if (!isSplit) return <>{children}{detail}</>;

  return <SplitGrid left={children} right={detail} overflowing={overflowing} detailScrollerRef={detailScrollerRef} />;
}
