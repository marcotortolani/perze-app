import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";

export interface ResolutionStep {
  label: string;
  done?: boolean | undefined;
}

export interface ResolutionChainProps {
  steps: ResolutionStep[];
  /** Índice del paso activo. */
  activeIndex: number;
  style?: CSSProperties | undefined;
}

/**
 * Lista de pasos numerados con uno activo — E6.2 (resolución de tipo de
 * cambio). Reaparece en importar, reglas de auto-categorización y orden
 * de fuentes de precios (Bloque I).
 */
export function ResolutionChain({ steps, activeIndex, style }: ResolutionChainProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      {steps.map((step, i) => {
        const active = i === activeIndex;
        const done = step.done ?? i < activeIndex;
        return (
          <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: done ? "var(--primary-fill)" : active ? "var(--surface-3)" : "var(--surface-2)",
                color: done ? "var(--primary-on-fill)" : active ? "var(--text-primary)" : "var(--text-muted)",
                fontSize: 12,
                fontWeight: 600,
                border: active && !done ? "1px solid var(--border)" : "none",
              }}
            >
              {done ? <Icon name="check" size={13} strokeWidth={2.5} /> : i + 1}
            </span>
            <span style={{ fontSize: 14, color: active ? "var(--text-primary)" : done ? "var(--text-secondary)" : "var(--text-muted)", fontWeight: active ? 500 : 400 }}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
