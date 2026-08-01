"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "../core/Icon";

export interface BannerProps {
  /** Cambios encolados localmente — solo tiene sentido con `status="offline"`. */
  pending?: number | undefined;
  /**
   * CON-18: un solo `Banner` para los tres casos — `offline` es el uso
   * original (sync encolado, no bloqueante), `warning`/`error` son para
   * cualquier otro aviso discreto (antes vivían fuera de este componente).
   */
  status?: "offline" | "warning" | "error" | undefined;
  /** Por defecto usa `ds.banner.<status>` (resuelto internamente). */
  message?: string | undefined;
  action?: { label: string; onClick: () => void } | undefined;
  style?: CSSProperties | undefined;
}

const STATUS_COLOR: Record<NonNullable<BannerProps["status"]>, string> = {
  offline: "var(--text-secondary)",
  warning: "var(--warning)",
  error: "var(--critical)",
};

/**
 * D4/auditoría: `--warning` (`#fab219`) da 1,76:1 contra `--page` en modo
 * claro — muy por debajo de AA (4,5:1) para texto. `--warning` va SOLO en
 * ícono/tinte de fondo; el texto (label del mensaje y del botón de acción)
 * usa `--text-primary`, que sí pasa AA en los dos modos. `offline`/`error`
 * no tenían este problema (`--text-secondary`/`--critical` ya pasaban) y
 * siguen coloreando su propio texto.
 */
const STATUS_TEXT_COLOR: Record<NonNullable<BannerProps["status"]>, string> = {
  offline: "var(--text-secondary)",
  warning: "var(--text-primary)",
  error: "var(--critical)",
};

const STATUS_ICON: Record<NonNullable<BannerProps["status"]>, "wifi" | "alert"> = {
  offline: "wifi",
  warning: "alert",
  error: "alert",
};

/** Banner discreto de offline/aviso/falla. La app sigue funcionando debajo. */
export function Banner({ pending = 0, status = "offline", message, action, style }: BannerProps) {
  const t = useTranslations();
  const color = STATUS_COLOR[status];
  const textColor = STATUS_TEXT_COLOR[status];
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px var(--screen-padding)",
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color: textColor,
        fontFamily: "var(--font-sans)",
        fontSize: 13,
        fontWeight: 500,
        ...style,
      }}
    >
      <Icon name={STATUS_ICON[status]} size={15} strokeWidth={2} color={color} />
      <span>{message ?? t(`ds.banner.${status}`)}</span>
      {pending > 0 ? (
        <span style={{ marginLeft: action ? undefined : "auto", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
          {t("ds.banner.pending", { count: pending })}
        </span>
      ) : null}
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          style={{ marginLeft: "auto", minHeight: 32, background: "none", border: 0, cursor: "pointer", color: textColor, fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, padding: "0 4px" }}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
