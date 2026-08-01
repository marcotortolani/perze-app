"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "../core/Icon";

export interface NeedsFxBannerProps {
  /**
   * Solo conteo — **nunca `amount`** (CLAUDE.md § needs_fx): un movimiento sin
   * `fx_rate` no tiene `amount_base`, así que sumar montos de monedas
   * distintas da un número sin significado. Corrige al `[spec]` original del
   * contrato, que sí llevaba `amount` y quedó marcado para sacar.
   */
  count: number;
  onResolve?: (() => void) | undefined;
  style?: CSSProperties | undefined;
}

/** LIB-03: todo agregado que excluye `needs_fx` declara cuántos excluyó, nunca cuánto. */
export function NeedsFxBanner({ count, onResolve, style }: NeedsFxBannerProps) {
  const t = useTranslations();
  if (count <= 0) return null;
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px var(--screen-padding)",
        background: "color-mix(in srgb, var(--warning) 12%, transparent)",
        color: "var(--warning)",
        fontFamily: "var(--font-sans)",
        fontSize: 13,
        fontWeight: 500,
        ...style,
      }}
    >
      <Icon name="alert" size={15} strokeWidth={2} />
      <span>{t("ds.needsFxBanner.message", { count })}</span>
      {onResolve ? (
        <button
          type="button"
          onClick={onResolve}
          style={{ marginLeft: "auto", minHeight: 32, background: "none", border: 0, cursor: "pointer", color: "var(--warning)", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, padding: "0 4px" }}
        >
          {t("ds.needsFxBanner.resolve")}
        </button>
      ) : null}
    </div>
  );
}
