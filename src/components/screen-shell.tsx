import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

export interface ScreenShellProps {
  children: ReactNode;
  /** Padding/gap/alignItems del contenido — el centrado y el ancho máximo ya los pone este componente. */
  style?: CSSProperties;
  background?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

/**
 * Envoltorio para las pantallas de página completa que no viven bajo
 * `(app)/layout.tsx` (captura, onboarding, formularios de cuenta/edición):
 * mismo patrón de columna centrada de `--content-max-width` que el shell
 * de la app, para que se vean bien en tablet/desktop sin estirarse
 * edge-to-edge. En mobile es indistinguible del comportamiento anterior.
 */
export function ScreenShell({ children, style, background = "var(--page)", onClick }: ScreenShellProps) {
  return (
    <div style={{ minHeight: "100svh", paddingTop: "var(--safe-top)", background, display: "flex", justifyContent: "center" }} onClick={onClick}>
      {/* `position: relative` — para que un `<Sheet>` (`position: absolute;
          inset: 0`) hijo quede acotado a esta columna en vez de taparle
          todo el viewport en desktop. */}
      <div style={{ position: "relative", width: "100%", maxWidth: "var(--content-max-width)", display: "flex", flexDirection: "column", ...style }}>
        {children}
      </div>
    </div>
  );
}
