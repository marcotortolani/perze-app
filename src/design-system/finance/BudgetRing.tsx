import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";

export interface BudgetRingProps {
  /** 0-1 normalmente; >1 dibuja el arco de sobregiro en critical más un ícono. */
  progress?: number | undefined;
  size?: number | undefined;
  stroke?: number | undefined;
  label?: string | undefined;
  sublabel?: string | undefined;
  style?: CSSProperties | undefined;
}

/** Anillo de progreso de presupuesto; el sobregiro es un arco critical superpuesto más un ícono, nunca color solo. */
export function BudgetRing({ progress = 0, size = 88, stroke = 8, label, sublabel, style }: BudgetRingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const over = progress > 1;
  const main = Math.min(1, progress);
  const overArc = over ? Math.min(1, progress - 1) : 0;
  const color = over ? "var(--critical)" : progress >= 0.8 ? "var(--warning)" : "var(--primary-ink)";

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8, ...style }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={over ? "var(--text-muted)" : color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - main)}
            style={{ transition: "stroke-dashoffset var(--duration-slow) var(--ease-spring-soft)" }}
          />
          {over ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="var(--critical)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - overArc)}
            />
          ) : null}
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          {over ? <Icon name="alert" size={15} strokeWidth={2.2} color="var(--critical)" /> : null}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontVariantNumeric: "tabular-nums",
              fontSize: 16,
              fontWeight: 600,
              color: over ? "var(--critical)" : "var(--text-primary)",
            }}
          >
            {Math.round(progress * 100)}%
          </span>
        </div>
      </div>
      {label ? <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{label}</span> : null}
      {sublabel ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{sublabel}</span> : null}
    </div>
  );
}
