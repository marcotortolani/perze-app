import type { CSSProperties, ReactNode } from "react";

export interface PrivacyBlurProps {
  /** Modo privacidad activo: los `children` quedan ocultos detrás de una píldora sólida, selección y pointer events bloqueados. */
  active?: boolean | undefined;
  children: ReactNode;
  style?: CSSProperties | undefined;
}

/**
 * Envuelve texto/cifras arbitrarias (lo que no pasa por `<Amount privacy>`,
 * que ya trae su propio tratamiento) para que el modo privacidad las pueda
 * ocultar en público. Los `children` reales se mantienen en el layout con
 * `visibility: hidden` — definen el tamaño de la caja, así que no hay
 * salto de layout al prender/apagar privacidad, ni un reajuste al espacio
 * disponible — y una píldora con blur + degradé del mismo ancho/alto
 * exacto (`inset: 0`) se dibuja encima, en vez de un `filter: blur()`
 * directo sobre el texto — ese blur necesita sangría para verse prolijo, y
 * cualquier ancestro con `overflow: hidden` se la recorta, dejando
 * manchones cortados. Acá el blur cae sobre una forma sólida propia, nunca
 * sobre el texto real. Mismo criterio que `<Amount privacy>`.
 */
export function PrivacyBlur({ active = false, children, style }: PrivacyBlurProps) {
  return (
    <span style={{ position: "relative", display: "inline-block", ...style }}>
      <span style={{ visibility: active ? "hidden" : "visible", userSelect: active ? "none" : "auto", pointerEvents: active ? "none" : "auto" }} aria-hidden={active || undefined}>
        {children}
      </span>
      {active ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "var(--radius-chip)",
            filter: "blur(3px)",
            background: "linear-gradient(135deg, color-mix(in srgb, var(--text-muted) 55%, transparent) 0%, color-mix(in srgb, var(--text-muted) 22%, transparent) 100%)",
          }}
        />
      ) : null}
    </span>
  );
}
