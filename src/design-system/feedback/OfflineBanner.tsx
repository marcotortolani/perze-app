"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "../core/Icon";

export interface OfflineBannerProps {
  /** Cambios encolados localmente. */
  pending?: number | undefined;
  /** critical se reserva para una falla de sync real. */
  status?: "warning" | "critical" | undefined;
  /** Por defecto usa `ds.offlineBanner.default` (resuelto internamente). */
  message?: string | undefined;
  style?: CSSProperties | undefined;
}

/** Banner discreto de offline/falla de sync. La app sigue funcionando debajo. */
export function OfflineBanner({ pending = 0, status = "warning", message, style }: OfflineBannerProps) {
  const t = useTranslations();
  const color = status === "critical" ? "var(--critical)" : "var(--warning)";
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px var(--screen-padding)",
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color,
        fontFamily: "var(--font-sans)",
        fontSize: 13,
        fontWeight: 500,
        ...style,
      }}
    >
      <Icon name={status === "critical" ? "alert" : "wifi"} size={15} strokeWidth={2} />
      <span>{message ?? t("ds.offlineBanner.default")}</span>
      {pending > 0 ? (
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
          {t("ds.offlineBanner.pending", { count: pending })}
        </span>
      ) : null}
    </div>
  );
}
