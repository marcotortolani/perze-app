"use client";

import type { ReactNode } from "react";
import { useIsDesktop, SPLIT_BREAKPOINT } from "@/hooks/use-is-desktop";

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
 */
export default function TransactionsLayout({ children, detail }: { children: ReactNode; detail: ReactNode }) {
  const isSplit = useIsDesktop(SPLIT_BREAKPOINT);

  if (!isSplit) return <>{children}{detail}</>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(340px,420px)", gap: 32, height: "100%", minHeight: 0 }}>
      <div style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</div>
      {/* `paddingRight`: sin esto la barra de scroll de esta columna queda
          pegada contra el borde del contenido (a diferencia de la lista de
          la izquierda, que hereda el `padding-inline` de `<main>` — esta
          columna no tiene ningún padding propio del lado derecho). */}
      <div style={{ minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", borderLeft: "1px solid var(--border)", paddingLeft: 32, paddingRight: 12 }}>{detail}</div>
    </div>
  );
}
