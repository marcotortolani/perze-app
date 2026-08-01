import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";
import { Button } from "../core/Button";

export interface ErrorStateProps {
  /** Qué pasó, en las palabras del usuario. */
  what: string;
  /** Qué hacer al respecto. */
  next?: string | undefined;
  onRetry?: (() => void) | undefined;
  /** Requerido cuando `onRetry` está presente — lo resuelve el caller vía `useTranslations`/`getTranslations`. */
  retryLabel?: string | undefined;
  /**
   * CON-16: segunda acción, un camino alternativo (ej. "ver offline",
   * "seguir sin esto") — va PRIMERO, antes de "reintentar", porque para
   * quien está bloqueado suele ser la salida más útil de las dos.
   */
  onAlternative?: (() => void) | undefined;
  alternativeLabel?: string | undefined;
  style?: CSSProperties | undefined;
}

/** Estado de error: qué pasó, qué hacer, reintentar. Nunca un stack trace. */
export function ErrorState({ what, next, onRetry, retryLabel, onAlternative, alternativeLabel, style }: ErrorStateProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "40px var(--screen-padding)", ...style }}>
      <Icon name="alert" size={28} strokeWidth={1.5} color="var(--critical)" />
      <p style={{ margin: 0, fontSize: 16, lineHeight: "22px", fontWeight: 500, color: "var(--text-primary)", maxWidth: "30ch", textWrap: "pretty" }}>{what}</p>
      {next ? <p style={{ margin: 0, fontSize: 14, lineHeight: "20px", color: "var(--text-secondary)", maxWidth: "32ch", textWrap: "pretty" }}>{next}</p> : null}
      {onAlternative || onRetry ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4, width: "100%", alignItems: "center" }}>
          {onAlternative ? (
            <Button variant="secondary" fullWidth={false} size="sm" onClick={onAlternative}>
              {alternativeLabel}
            </Button>
          ) : null}
          {onRetry ? (
            <Button variant="ghost" fullWidth={false} size="sm" icon="refresh" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
