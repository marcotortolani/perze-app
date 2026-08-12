import type { CSSProperties } from "react";
import { formatNumber } from "@/lib/money/format";

export interface DeltaPctProps {
  /** Ya en porcentaje (12.4, no 0.124). */
  value: number;
  decimals?: number;
  size?: number;
  style?: CSSProperties;
}

/**
 * Variación porcentual con flecha — CLAUDE.md: fuera del home nunca
 * verde/rojo. Ganancia en `--money-positive` (aqua), pérdida en texto
 * neutro (nunca rojo); la flecha y el signo son la codificación
 * secundaria que hace que el color no sea la única señal.
 *
 * Antes este patrón (`↑ X%`) se escribía a mano en cada call site
 * (`OverviewContent.tsx`), sin color — es el mismo hueco que documentó la
 * exploración del bloque I: el design system tiene `StatTile.delta` y
 * `PositionRow.changePct`, pero ambos toman un `ReactNode` ya formateado
 * por el caller. Este componente es lo que va adentro de esos slots.
 */
export function DeltaPct({ value, decimals = 1, size = 12, style }: DeltaPctProps) {
  const positive = value >= 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 2,
        fontSize: size,
        fontVariantNumeric: "tabular-nums",
        color: positive ? "var(--money-positive)" : "var(--text-primary)",
        ...style,
      }}
    >
      {positive ? "↑" : "↓"} {formatNumber(Math.abs(value), decimals)}%
    </span>
  );
}
