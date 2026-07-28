import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "style"> {
  /** Plano de superficie. Nunca apilar más de 3. */
  surface?: 1 | 2 | 3 | undefined;
  /** Bordes solo donde el espaciado no alcanza — un card sobre superficie 1 no necesita uno. */
  bordered?: boolean | undefined;
  padding?: number | string | undefined;
  radius?: number | string | undefined;
  children?: ReactNode | undefined;
  style?: CSSProperties | undefined;
}

/** Contenedor de contenido: radio 20, sin sombra. La jerarquía viene de superficie + espaciado. */
export function Card({ surface = 1, bordered = false, padding = 20, radius, children, style, ...rest }: CardProps) {
  return (
    <div
      style={{
        background: `var(--surface-${surface})`,
        borderRadius: radius ?? "var(--radius-card)",
        padding,
        border: bordered ? "1px solid var(--border)" : "none",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
