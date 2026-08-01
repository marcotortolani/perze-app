import type { CSSProperties } from "react";
import { Skeleton, SkeletonRow } from "./Skeleton";

export interface SkeletonBlockProps {
  variant: "hero" | "list" | "cards" | "chart";
  /** Filas/tarjetas a repetir — ignorado en `hero` y `chart`, que tienen forma fija. */
  rows?: number | undefined;
  style?: CSSProperties | undefined;
}

/** Las cuatro plantillas de carga de L2 — antes rearmadas a mano en cada pantalla. */
export function SkeletonBlock({ variant, rows = 3, style }: SkeletonBlockProps) {
  return (
    <div aria-busy="true" style={style}>
      {variant === "hero" ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "24px 0" }}>
          <Skeleton width={140} height={16} />
          <Skeleton width={220} height={44} />
          <Skeleton width={100} height={14} />
        </div>
      ) : null}

      {variant === "list" ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {Array.from({ length: rows }, (_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : null}

      {variant === "cards" ? (
        <div style={{ display: "flex", gap: 12, overflowX: "hidden" }}>
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} width={160} height={88} radius={20} />
          ))}
        </div>
      ) : null}

      {variant === "chart" ? (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 130 }}>
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} width={28} height={40 + ((i * 37) % 90)} radius={6} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
