import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";

export interface MirrorBannerProps {
  /** "Viendo la app como Ana", ya traducido por el caller. */
  message: string;
  exitLabel: string;
  onExit: () => void;
  style?: CSSProperties | undefined;
}

/**
 * LIB-15: barra persistente de salida del modo espejo (J4). El modo espejo
 * en sí no vive en RLS — es una consulta de servidor con `can_see` del otro
 * miembro (CLAUDE.md § schema, decisión 1) — este componente solo es la
 * salida visible y permanente mientras el modo está activo.
 */
export function MirrorBanner({ message, exitLabel, onExit, style }: MirrorBannerProps) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px var(--screen-padding)",
        background: "var(--surface-3)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)",
        fontSize: 13,
        fontWeight: 500,
        ...style,
      }}
    >
      <Icon name="eye" size={15} strokeWidth={2} color="var(--text-secondary)" />
      <span>{message}</span>
      <button
        type="button"
        onClick={onExit}
        style={{ marginLeft: "auto", minHeight: 32, background: "none", border: 0, cursor: "pointer", color: "var(--primary-ink)", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, padding: "0 4px" }}
      >
        {exitLabel}
      </button>
    </div>
  );
}
