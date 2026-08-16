"use client";

import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";

export interface ColumnMappingRowProps {
  /** Nombre crudo de la columna del archivo, tal cual vino. */
  rawHeader: string;
  /** Campo de destino ya resuelto, o `null` si esta columna quedó sin mapear. */
  destination: string | null;
  onClick?: (() => void) | undefined;
  style?: CSSProperties | undefined;
}

/** K9b — nombre crudo en mono arriba, destino resuelto abajo, check si está resuelto o el ícono de alerta si no. */
export function ColumnMappingRow({ rawHeader, destination, onClick, style }: ColumnMappingRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        minHeight: 56,
        padding: "8px 0",
        background: "none",
        border: 0,
        textAlign: "left",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rawHeader}</div>
        {/* `--warning-text`, no `--warning`: es texto (15px), y `--warning`
            da 1,76:1 contra `--page` en claro — falla AA. El ícono de
            abajo es gráfico (3:1 alcanza), sigue en `--warning`. */}
        <div style={{ fontSize: 15, color: destination ? "var(--text-primary)" : "var(--warning-text)", marginTop: 2 }}>{destination ?? "—"}</div>
      </div>
      <Icon name={destination ? "check" : "alert"} size={18} color={destination ? "var(--good)" : "var(--warning)"} />
    </button>
  );
}
