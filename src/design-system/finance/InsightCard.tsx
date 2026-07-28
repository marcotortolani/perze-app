import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "../core/Icon";

const COLORS: Record<NonNullable<InsightCardProps["status"]>, string> = {
  good: "var(--good)",
  warning: "var(--warning)",
  serious: "var(--serious)",
  critical: "var(--critical)",
  neutral: "var(--text-secondary)",
};

export interface InsightCardProps {
  status?: "good" | "warning" | "serious" | "critical" | "neutral" | undefined;
  icon?: IconName | undefined;
  /** Exactamente una línea de insight en lenguaje llano. */
  text: ReactNode;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  sparkline?: ReactNode | undefined;
  /** Presente = descartable con swipe/tap. */
  onDismiss?: (() => void) | undefined;
  /** Requerido cuando `onDismiss` está presente — lo resuelve el caller vía `useTranslations`. */
  dismissLabel?: string | undefined;
  style?: CSSProperties | undefined;
}

/** Insight de una línea con ícono de estado, un sparkline opcional y exactamente una acción. Se descarta con swipe. */
export function InsightCard({ status = "neutral", icon, text, actionLabel, onAction, sparkline, onDismiss, dismissLabel, style }: InsightCardProps) {
  return (
    <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 16, display: "flex", alignItems: "flex-start", gap: 12, ...style }}>
      <Icon
        name={icon ?? (status === "critical" ? "alert" : status === "good" ? "check" : "trend")}
        size={20}
        strokeWidth={1.8}
        color={COLORS[status]}
        style={{ marginTop: 2 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, lineHeight: "21px", color: "var(--text-primary)", textWrap: "pretty" }}>{text}</div>
        {sparkline ? <div style={{ marginTop: 10 }}>{sparkline}</div> : null}
        {actionLabel ? (
          <button
            type="button"
            onClick={onAction}
            style={{ marginTop: 10, background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--primary-ink)", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500 }}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} aria-label={dismissLabel} style={{ background: "none", border: 0, padding: 4, margin: -4, cursor: "pointer" }}>
          <Icon name="close" size={16} color="var(--text-muted)" />
        </button>
      ) : null}
    </div>
  );
}
