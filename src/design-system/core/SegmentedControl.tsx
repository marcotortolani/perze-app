import type { CSSProperties } from "react";
import { Icon, type IconName } from "./Icon";

export interface SegmentedOption {
  id: string;
  label: string;
  icon?: IconName | undefined;
}

export interface SegmentedControlProps {
  /** 2-4 segmentos. Más de 4 es un Sheet, no un segmentado. */
  options: (string | SegmentedOption)[];
  value?: string | undefined;
  onChange?: ((id: string) => void) | undefined;
  /** Alto de cada segmento (el target real): md = 44px (el piso del sistema), sm = 36px para uso dentro de un card. */
  size?: "md" | "sm" | undefined;
  /**
   * surface (default) = segmento activo en superficie 3, no gasta nada del presupuesto de violeta.
   * brand = segmento activo con relleno de marca. Reservado para identidad de datos (scope del household), nunca para una elección de formulario.
   */
  emphasis?: "surface" | "brand" | undefined;
  style?: CSSProperties | undefined;
}

/**
 * 2-4 opciones mutuamente excluyentes. La selección se resuelve por
 * SUPERFICIE (superficie 3 sobre superficie 1), nunca por relleno de
 * marca, así no gasta nada del presupuesto de violeta de la pantalla.
 *
 * `role="radiogroup"` + `aria-checked` por opción — no `tablist`/`tab`:
 * un segmentado es una elección única, no un panel de contenido, y sin
 * `aria-checked` un lector de pantalla no puede decir cuál está elegida.
 */
export function SegmentedControl({
  options = [],
  value,
  onChange,
  size = "md",
  emphasis = "surface",
  style,
  ...rest
}: SegmentedControlProps) {
  const brand = emphasis === "brand";
  const firstOption = options[0];
  const firstId = firstOption === undefined ? undefined : typeof firstOption === "string" ? firstOption : firstOption.id;
  const active = value ?? firstId;
  const height = size === "sm" ? 36 : 44;

  return (
    <div
      role="radiogroup"
      style={{
        display: "inline-flex",
        gap: 2,
        padding: 3,
        borderRadius: "var(--radius-chip)",
        background: "var(--surface-2)",
        ...style,
      }}
      {...rest}
    >
      {options.map((o) => {
        const id = typeof o === "string" ? o : o.id;
        const label = typeof o === "string" ? o : o.label;
        const icon = typeof o === "string" ? undefined : o.icon;
        const on = id === active;
        return (
          <button
            key={id}
            role="radio"
            aria-checked={on}
            type="button"
            onClick={() => onChange?.(id)}
            style={{
              height,
              minWidth: 44,
              padding: "0 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderRadius: "var(--radius-chip)",
              border: 0,
              cursor: "pointer",
              background: on ? (brand ? "var(--primary-fill)" : "var(--selection-surface)") : "transparent",
              boxShadow: on && !brand ? "inset 0 0 0 1px var(--selection-ring)" : "none",
              color: on ? (brand ? "var(--primary-on-fill)" : "var(--text-primary)") : "var(--text-muted)",
              fontFamily: "var(--font-sans)",
              fontSize: size === "sm" ? 13 : 15,
              fontWeight: 500,
              lineHeight: 1,
              transition: "background var(--duration-fast) var(--ease-spring-snappy), color var(--duration-fast) linear",
            }}
          >
            {icon ? <Icon name={icon} size={16} strokeWidth={1.75} /> : null}
            {label}
          </button>
        );
      })}
    </div>
  );
}
