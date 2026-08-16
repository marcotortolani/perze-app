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
  // `--warning-text`, no `--warning`: este color pinta el texto de la
  // píldora, y `--warning` (#fab219) da 1,76:1 contra `--page` en modo
  // claro — falla AA. El fondo (`background` de abajo, `color-mix` al 15%)
  // sigue derivando de `--warning` sin tocar, ahí el contraste requerido
  // es el de un elemento gráfico, no el de texto.
  warning: { color: "var(--warning-text)", background: "color-mix(in srgb, var(--warning) 15%, transparent)", icon: "alert" },
  serious: { color: "var(--serious)", icon: "arrow-up" },
  critical: { color: "var(--critical)", icon: "close" },
};

export interface StatusBadgeProps {
  /** Rampa de estado fija — nunca tematizada, nunca reusada como color de serie de gráfico. */
  status?: "neutral" | "good" | "warning" | "serious" | "critical" | undefined;
  /**
   * CON-09 (docs/plan-de-trabajo.md § 4): el escalamiento por edad vive
   * ACÁ, no en el caller — pasá `ageDays` (días desde que algo quedó
   * `neutral`, ej. un `needs_fx` pendiente) y el componente decide solo si
   * corresponde subir a `warning` a partir de una semana
   * (`docs/02-design-system.md` § 6, mismo umbral que `lib/fx/resolve.ts`
   * `needsFxSeverity()`). Solo aplica cuando `status="neutral"` — los
   * demás niveles no escalan por tiempo, son estados explícitos.
   */
  ageDays?: number | undefined;
  /** Siempre requerido: el color solo nunca porta el significado. */
  children: ReactNode;
  icon?: IconName | undefined;
  style?: CSSProperties | undefined;
}

const AGE_ESCALATION_THRESHOLD_DAYS = 7;

/**
 * Extraída como función pura testeable: `neutral` + 7 días o más → `warning`,
 * cualquier otro estado no escala por tiempo (son explícitos).
 */
export function resolveBadgeStatus(
  status: NonNullable<StatusBadgeProps["status"]>,
  ageDays: number | undefined
): NonNullable<StatusBadgeProps["status"]> {
  if (status === "neutral" && ageDays !== undefined && ageDays >= AGE_ESCALATION_THRESHOLD_DAYS) return "warning";
  return status;
}

/** Píldora de estado: siempre ícono + label, nunca color solo. El rojo nunca significa "gasto". */
export function StatusBadge({ status = "good", ageDays, children, icon, style }: StatusBadgeProps) {
  const effectiveStatus = resolveBadgeStatus(status, ageDays);
  const s = STATUS_MAP[effectiveStatus];
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
