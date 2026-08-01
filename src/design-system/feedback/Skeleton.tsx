import type { CSSProperties } from "react";
import { normalizeSize } from "../core/size";

export interface SkeletonProps {
  width?: number | string | undefined;
  height?: number | string | undefined;
  radius?: number | string | undefined;
  style?: CSSProperties | undefined;
}

/** Placeholder de carga que respeta la forma real. Cero spinners de pantalla completa. */
export function Skeleton({ width = "100%", height = 16, radius = 8, style }: SkeletonProps) {
  return (
    <span
      style={{
        display: "block",
        width: normalizeSize(width),
        height: normalizeSize(height),
        borderRadius: normalizeSize(radius),
        background: "var(--surface-2)",
        animation: "ds-skel 1.4s ease-in-out infinite",
        ...style,
      }}
    >
      <style>{"@keyframes ds-skel{0%,100%{opacity:1}50%{opacity:.55}}"}</style>
    </span>
  );
}

/** Skeleton pre-armado que calza con un `TransactionRow`. */
export function SkeletonRow({ style }: { style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 0", ...style }}>
      <Skeleton width={40} height={40} radius={12} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <Skeleton width="52%" height={14} />
        <Skeleton width="34%" height={11} />
      </div>
      <Skeleton width={64} height={14} />
    </div>
  );
}
