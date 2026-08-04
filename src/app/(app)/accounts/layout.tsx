"use client";

import type { CSSProperties, ReactNode } from "react";
import { useIsDesktop, SPLIT_BREAKPOINT } from "@/hooks/use-is-desktop";
import { useScrollOverflow } from "@/hooks/use-scroll-overflow";

/** E1/E2 en dos columnas de escritorio — mismo patrón que `transactions/layout.tsx`, ver esa nota. */
export default function AccountsLayout({ children, detail }: { children: ReactNode; detail: ReactNode }) {
  const isSplit = useIsDesktop(SPLIT_BREAKPOINT);
  const { ref: detailScrollerRef, overflowing } = useScrollOverflow<HTMLDivElement>();

  if (!isSplit) return <>{children}{detail}</>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(340px,420px)", gap: 32, height: "100%", minHeight: 0 }}>
      <div style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</div>
      {/* `paddingRight`: sin esto la barra de scroll de esta columna queda pegada contra el borde del contenido — ver la misma nota en `transactions/layout.tsx`.
          `minWidth: 0`: sin esto el ítem de grid vale `min-width: auto` y su
          ancho intrínseco (una cifra héroe larga, el chart) podía forzarlo
          más ancho que el track de `minmax(340px,420px)` — y `overflow-y:
          auto` sin un `overflow-x` explícito activa `overflow-x: auto`
          implícito por regla de CSSOM (spec de `overflow`), de ahí el
          scroll horizontal. `overflowX: hidden` lo cierra del todo: el
          contenido de esta columna siempre tiene que entrar en su ancho. */}
      {/* `scroll-fade-bottom` en un wrapper propio (no en el scroller): el
          scroller de abajo ya tiene `overflowY:auto` sin `position:relative`
          propio, pero el patrón se mantiene igual que en accounts/page.tsx —
          el fade necesita un contenedor no-scrolleable como containing
          block. `paddingBottom: 32` adentro del scroller: aire real al
          final para el fade, mismo criterio que el resto. */}
      <div className="scroll-fade-bottom" data-scroll-overflow={overflowing} style={{ "--scroll-fade-inset-right": "12px", minWidth: 0, maxWidth: 420, minHeight: 0 } as CSSProperties}>
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
          {detail}
        </div>
      </div>
    </div>
  );
}
