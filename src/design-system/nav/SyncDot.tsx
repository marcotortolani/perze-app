import type { CSSProperties } from "react";

export interface SyncDotProps {
  /** synced = tinta muted (todo bien es el caso normal y no merece color). */
  state?: "synced" | "syncing" | "offline" | undefined;
  /** Cambios locales encolados, se muestra al lado del punto cuando está offline. */
  pending?: number | undefined;
  style?: CSSProperties | undefined;
}

/** Indicador de sync de 6px en el header. Los errores de sync NO se muestran acá — llevan un banner critical. */
export function SyncDot({ state = "synced", pending = 0, style }: SyncDotProps) {
  const color = state === "synced" ? "var(--text-muted)" : "var(--warning)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, ...style }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: color,
          animation: state === "syncing" ? "ds-sync-pulse 1.2s var(--ease-spring-soft) infinite" : "none",
        }}
      />
      {state === "offline" && pending > 0 ? (
        // `--warning-text`, no `--warning`: acá sí es texto (el conteo),
        // y `--warning` da 1,76:1 contra `--page` en claro — falla AA. El
        // punto de arriba es gráfico (3:1 alcanza), sigue en `--warning`.
        <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 11, color: "var(--warning-text)" }}>{pending}</span>
      ) : null}
      <style>{"@keyframes ds-sync-pulse{0%,100%{opacity:1}50%{opacity:.3}}"}</style>
    </span>
  );
}
