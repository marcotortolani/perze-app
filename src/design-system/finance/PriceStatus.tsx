"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { StatusBadge } from "../core/StatusBadge";
import { Icon } from "../core/Icon";

export interface PriceStatusProps {
  /** `manual`/`market-closed` son estados normales del dato, no un error — badge `neutral`. */
  state: "fresh" | "stale" | "manual" | "market-closed";
  ageHours?: number | undefined;
  onUpdate?: (() => void) | undefined;
  style?: CSSProperties | undefined;
}

const BADGE_STATUS: Record<PriceStatusProps["state"], "good" | "warning" | "neutral"> = {
  fresh: "good",
  stale: "warning",
  manual: "neutral",
  "market-closed": "neutral",
};

/** LIB-01: el par badge + "actualizar a mano" de I2/I3/I4/I12. Un precio sin proveedor es `neutral`, no un error. */
export function PriceStatus({ state, ageHours, onUpdate, style }: PriceStatusProps) {
  const t = useTranslations();
  const label =
    state === "fresh"
      ? t("ds.priceStatus.fresh")
      : state === "stale"
        ? t("ds.priceStatus.stale", { hours: ageHours ?? 0 })
        : state === "manual"
          ? t("ds.priceStatus.manual")
          : t("ds.priceStatus.marketClosed");

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, ...style }}>
      <StatusBadge status={BADGE_STATUS[state]} icon={state === "fresh" ? "check" : state === "stale" ? "clock" : undefined}>
        {label}
      </StatusBadge>
      {onUpdate ? (
        <button
          type="button"
          onClick={onUpdate}
          aria-label={t("ds.priceStatus.update")}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, background: "none", border: 0, cursor: "pointer" }}
        >
          <Icon name="refresh" size={15} color="var(--text-secondary)" />
        </button>
      ) : null}
    </span>
  );
}
