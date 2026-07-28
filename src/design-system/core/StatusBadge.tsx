import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * Cuándo va cada nivel:
 * neutral — falta algo que se resuelve solo (no es un problema, es un dato que todavía no llegó)
 * warning — prestá atención
 * serious — algo cambió y te conviene mirarlo
 * critical — algo está mal ahora
 */
const STATUS_MAP: Record<
  NonNullable<StatusBadgeProps["status"]>,
  { color: string; background?: string; icon: IconName }
> = {
  neutral: { color: "var(--text-secondary)", background: "var(--surface-2)", icon: "clock" },
  good: { color: "var(--good)", icon: "check" },
  warning: { color: "var(--warning)", icon: "alert" },
  serious: { color: "var(--serious)", icon: "arrow-up" },
  critical: { color: "var(--critical)", icon: "close" },
};

export interface StatusBadgeProps {
  /** Rampa de estado fija — nunca tematizada, nunca reusada como color de serie de gráfico. */
  status?: "neutral" | "good" | "warning" | "serious" | "critical" | undefined;
  /** Siempre requerido: el color solo nunca porta el significado. */
  children: ReactNode;
  icon?: IconName | undefined;
  style?: CSSProperties | undefined;
}

/** Píldora de estado: siempre ícono + label, nunca color solo. El rojo nunca significa "gasto". */
export function StatusBadge({ status = "good", children, icon, style }: StatusBadgeProps) {
  const s = STATUS_MAP[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 9px",
        borderRadius: "var(--radius-chip)",
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
        fontSize: 12,
        lineHeight: 1.4,
        color: s.color,
        background: s.background ?? `color-mix(in srgb, ${s.color} 15%, transparent)`,
        ...style,
      }}
    >
      <Icon name={icon ?? s.icon} size={13} strokeWidth={2.5} />
      {children}
    </span>
  );
}
