"use client";

import type { ReactNode } from "react";
import { useIsDesktop, SPLIT_BREAKPOINT } from "@/hooks/use-is-desktop";

/** E1/E2 en dos columnas de escritorio — mismo patrón que `transactions/layout.tsx`, ver esa nota. */
export default function AccountsLayout({ children, detail }: { children: ReactNode; detail: ReactNode }) {
  const isSplit = useIsDesktop(SPLIT_BREAKPOINT);

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
      <div
        style={{
          minWidth: 0,
          maxWidth: 420,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          overscrollBehavior: "contain",
          borderLeft: "1px solid var(--border)",
          paddingLeft: 32,
          paddingRight: 12,
        }}
      >
        {detail}
      </div>
    </div>
  );
}
