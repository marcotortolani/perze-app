import type { CSSProperties } from "react";
import { Icon, type IconName } from "../core/Icon";
import { Button } from "../core/Button";

export interface EmptyStateProps {
  icon?: IconName | undefined;
  /** Una oración real en lenguaje llano — nunca "No hay datos". */
  message: string;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  style?: CSSProperties | undefined;
}

/** Un ícono de línea, una frase, una acción. Obligatorio en toda pantalla que muestre listas. */
export function EmptyState({ icon = "wallet", message, actionLabel, onAction, style }: EmptyStateProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16, padding: "48px var(--screen-padding)", ...style }}>
      <Icon name={icon} size={32} strokeWidth={1.25} color="var(--text-muted)" />
      <p style={{ margin: 0, fontSize: 15, lineHeight: "22px", color: "var(--text-secondary)", maxWidth: "28ch", textWrap: "pretty" }}>{message}</p>
      {actionLabel ? (
        <Button variant="secondary" fullWidth={false} size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
