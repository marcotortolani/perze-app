import type { CSSProperties } from "react";
import { Button } from "../core/Button";
import { ZMark } from "../core/ZMark";

export interface EmptyStateProps {
  /** Una oración real en lenguaje llano — nunca "No hay datos". */
  message: string;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  style?: CSSProperties | undefined;
}

/** CON-19: la marca `ZMark`, una frase, una acción. Obligatorio en toda pantalla que muestre listas. */
export function EmptyState({ message, actionLabel, onAction, style }: EmptyStateProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16, padding: "48px var(--screen-padding)", ...style }}>
      <ZMark size={18} gap={5} />
      <p style={{ margin: 0, fontSize: 15, lineHeight: "22px", color: "var(--text-secondary)", maxWidth: "28ch", textWrap: "pretty" }}>{message}</p>
      {actionLabel ? (
        <Button variant="secondary" fullWidth={false} size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
