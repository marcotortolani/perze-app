import type { CSSProperties } from "react";
import { Icon } from "./Icon";

export interface DismissibleNoticeProps {
  message: string;
  onDismiss: () => void;
  /** aria-label del botón de cerrar — lo resuelve el caller vía `useTranslations`. */
  dismissLabel: string;
  style?: CSSProperties | undefined;
}

/**
 * Aviso de una sola vez, sin nivel de estado y sin acción primaria — p. ej.
 * "podés poner Inversiones en la barra desde Ajustes" (B1). `InsightCard`
 * no sirve acá: exige `status` y trae una acción con dismiss combinados.
 */
export function DismissibleNotice({ message, onDismiss, dismissLabel, style }: DismissibleNoticeProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "var(--surface-2)",
        borderRadius: "var(--radius-card)",
        padding: "12px 14px",
        ...style,
      }}
    >
      <span style={{ flex: 1, fontSize: 13, lineHeight: "18px", color: "var(--text-secondary)" }}>{message}</span>
      <button type="button" onClick={onDismiss} aria-label={dismissLabel} style={{ background: "none", border: 0, padding: 4, margin: -4, cursor: "pointer" }}>
        <Icon name="close" size={15} color="var(--text-muted)" />
      </button>
    </div>
  );
}
