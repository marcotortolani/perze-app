"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useIsDesktop, SPLIT_BREAKPOINT } from "@/hooks/use-is-desktop";
import { useScrollOverflow } from "@/hooks/use-scroll-overflow";
import { MovementsListContent } from "./page";

/** `/transactions/<uuid>` exacto — nunca matchea `/transactions`, `/transactions/calendar` ni subrutas con más segmentos. */
const DETAIL_ID_PATTERN = /^\/transactions\/([0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12})$/i;

function SplitGrid({ left, right, overflowing, detailScrollerRef }: { left: ReactNode; right: ReactNode; overflowing: boolean; detailScrollerRef: (node: HTMLDivElement | null) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(340px,420px)", gap: 32, height: "100%", minHeight: 0 }}>
      <div style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>{left}</div>
      {/* `paddingRight`: sin esto la barra de scroll de esta columna queda
          pegada contra el borde del contenido (a diferencia de la lista de
          la izquierda, que hereda el `padding-inline` de `<main>` — esta
          columna no tiene ningún padding propio del lado derecho).
          `minWidth: 0` + `overflowX: hidden`: mismo fix que
          `accounts/layout.tsx` — sin `minWidth: 0` el ítem de grid vale
          `min-width: auto` y el contenido (una cifra larga, un chart)
          podía forzarlo más ancho que `minmax(340px,420px)`, y
          `overflow-y: auto` sin `overflow-x` explícito activa
          `overflow-x: auto` implícito por la propia regla de `overflow`. */}
      {/* `scroll-fade-bottom` en un wrapper propio — mismo patrón que
          `accounts/layout.tsx`. `paddingBottom: 32` adentro del scroller:
          aire real al final para el fade. */}
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
          {right}
        </div>
      </div>
    </div>
  );
}

/**
 * D1/D2 en dos columnas de escritorio (`docs/02-design-system.md` §
 * "Desktop": "sidebar fijo, dos columnas (lista + detalle)"). `@detail`
 * intercepta `/transactions/[id]` (ver `@detail/(.)[id]/page.tsx`, mismo
 * patrón que `(app)/@modal/(.)add`) y aparece acá al lado de la lista en
 * vez de reemplazarla — en mobile Y en el tramo 1024–1279, ese mismo
 * contenido se dibuja como overlay de pantalla completa (lo decide el
 * propio interceptor): a 1024px el sidebar (248px) más un panel de detalle
 * legible no dejan lugar para una lista usable, así que el split recién
 * arranca en `SPLIT_BREAKPOINT` (1280px).
 *
 * Caso especial — hard-reload de `/transactions/<id>`: mismo problema y
 * mismo arreglo que `accounts/layout.tsx` (ver esa nota completa). Un
 * hard-reload no pasa por la ruta interceptora: `children` termina siendo
 * el DETALLE (no la lista) y `@detail` cae a su placeholder vacío. Se
 * detecta comparando `pathname` con el pathname del PRIMER render de este
 * layout (no con el actual): una navegación interceptada (tocar un
 * movimiento con la lista ya montada) también deja `pathname` en
 * `/transactions/<id>`, pero no remonta el layout — comparar solo contra
 * `pathname` actual hacía que ese caso tomara la misma rama que un
 * hard-reload real, devolviendo `children` (la lista) y descartando el
 * slot `detail` (el `Modal` con el detalle): en mobile, tocar un
 * movimiento no abría nada. El layout SÍ se remonta en un hard-reload, en
 * un link externo o al entrar desde otra sección (`/` → `/transactions/<id>`),
 * así que ahí el pathname inicial y el actual coinciden y se arma la lista
 * a mano con `MovementsListContent`, ignorando el slot `detail`.
 */
export default function TransactionsLayout({ children, detail }: { children: ReactNode; detail: ReactNode }) {
  const isSplit = useIsDesktop(SPLIT_BREAKPOINT);
  const pathname = usePathname();
  const { ref: detailScrollerRef, overflowing } = useScrollOverflow<HTMLDivElement>();

  const [initialPathname] = useState(pathname);
  const initialDetailId = initialPathname.match(DETAIL_ID_PATTERN)?.[1];
  const hardNavId = initialDetailId && pathname === initialPathname ? initialDetailId : undefined;

  if (hardNavId) {
    if (!isSplit) return <>{children}</>;
    return <SplitGrid left={<MovementsListContent />} right={children} overflowing={overflowing} detailScrollerRef={detailScrollerRef} />;
  }

  if (!isSplit) return <>{children}{detail}</>;

  return <SplitGrid left={children} right={detail} overflowing={overflowing} detailScrollerRef={detailScrollerRef} />;
}
