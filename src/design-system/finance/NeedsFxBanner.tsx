"use client";

import type { CSSProperties } from "react";
import { motion, type MotionStyle } from "motion/react";
import { useTranslations } from "next-intl";
import { Icon } from "../core/Icon";
import { useMotionIntensity } from "@/components/motion";
import { spring } from "@/lib/motion/springs";

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
  const intensity = useMotionIntensity();
  if (count <= 0) return null;
  // Casi todo caller lo monta/desmonta con `{count > 0 ? <NeedsFxBanner/> :
  // null}` en vez de mantenerlo montado con `count=0` — así que un
  // `AnimatePresence` ACÁ ADENTRO nunca llegaría a animar la salida (el
  // padre ya lo sacó del árbol). Lo que sí se puede resolver sin tocar los
  // ~10 callers es la ENTRADA: antes aparecía de golpe. `initial={false}`
  // en "mínima" deja el nodo asentado en el estado final sin animar,
  // mismo criterio que `DetailPanelTransition`.
  return (
    <motion.div
      role="status"
      initial={intensity === "minimal" ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.default}
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
        // `as MotionStyle`: `style` es `CSSProperties` (la API pública que
        // ya usan ~10 callers), pero con `exactOptionalPropertyTypes` no es
        // asignable directo al `style` de `motion.div` — mismo caso que
        // documenta `PageEnter.tsx`. Ningún caller pasa `x`/`y`/etc (los
        // únicos campos donde las dos formas divergen de verdad), así que
        // el cast es seguro acá.
      } as MotionStyle}
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
    </motion.div>
  );
}
