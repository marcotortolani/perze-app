"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "../core/Icon";
import { AnimatedBanner } from "@/components/motion";

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

/**
 * LIB-03: todo agregado que excluye `needs_fx` declara cuántos excluyó,
 * nunca cuánto.
 *
 * Siempre montado — el caller pasa `count` tal cual, sin condicionar el
 * montaje por fuera con `{count > 0 ? <NeedsFxBanner .../> : null}`. Antes
 * cada uno de los ~10 callers hacía ese `if` a mano, así que el banner
 * aparecía animado (`initial`/`animate`) pero desaparecía de golpe: React
 * lo sacaba del árbol en el mismo frame en que `count` bajaba a 0, sin
 * nada que anime la salida. `AnimatedBanner` (mismo componente que ya
 * resuelve esto para los banners del home, `src/components/motion/`)
 * mantiene el nodo montado durante la transición de salida — acá solo hace
 * falta decirle `show={count > 0}` y dejar que decida.
 */
export function NeedsFxBanner({ count, onResolve, style }: NeedsFxBannerProps) {
  const t = useTranslations();
  return (
    <AnimatedBanner show={count > 0}>
      <div
        role="status"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px var(--screen-padding)",
          background: "color-mix(in srgb, var(--warning) 12%, transparent)",
          // D4/auditoría: `--warning` da 1,76:1 contra `--page` en claro — muy
          // por debajo de AA. Va solo en el ícono (abajo); el texto usa
          // `--text-primary`, que sí pasa AA en los dos modos.
          color: "var(--text-primary)",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 500,
          ...style,
        }}
      >
        <Icon name="alert" size={15} strokeWidth={2} color="var(--warning)" />
        <span>{t("ds.needsFxBanner.message", { count })}</span>
        {onResolve ? (
          <button
            type="button"
            onClick={onResolve}
            style={{ marginLeft: "auto", minHeight: 32, background: "none", border: 0, cursor: "pointer", color: "var(--text-primary)", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, padding: "0 4px" }}
          >
            {t("ds.needsFxBanner.resolve")}
          </button>
        ) : null}
      </div>
    </AnimatedBanner>
  );
}
