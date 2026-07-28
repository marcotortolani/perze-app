import type { CSSProperties } from "react";

export interface ProgressBarProps {
  /** 0-1 normalmente; >1 se recorta visualmente a 1 pero el color pasa a critical. */
  value: number;
  height?: number | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Una magnitud contra un techo — el consumo de una tarjeta de crédito
 * contra su límite (E4.1), la exposición por moneda contra el total
 * (E6.1). Había `BudgetRing` y `SplitBar`, pero no una barra lineal.
 */
export function ProgressBar({ value, height = 8, style }: ProgressBarProps) {
  const over = value > 1;
  const clamped = Math.min(1, Math.max(0, value));
  const color = over ? "var(--critical)" : value >= 0.8 ? "var(--warning)" : "var(--primary-fill)";
  return (
    <div style={{ height, borderRadius: 999, background: "var(--surface-3)", overflow: "hidden", ...style }}>
      <div
        style={{
          width: `${clamped * 100}%`,
          height: "100%",
          borderRadius: 999,
          background: color,
          transition: "width var(--duration-slow) var(--ease-spring-soft)",
        }}
      />
    </div>
  );
}
