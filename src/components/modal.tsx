"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Envoltorio de la ruta interceptada `/add` — URL propia, back nativo.
 * `router.back()` cierra volviendo a donde estaba, sin re-fetch de la
 * pantalla de abajo (a diferencia de `router.push('/')`).
 */
export function Modal({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) router.back();
      }}
    >
      {children}
    </div>
  );
}
