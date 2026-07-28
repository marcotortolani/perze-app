import type { CSSProperties, ReactNode } from "react";

export interface PrivacyBlurProps {
  /** Modo privacidad activo: blur(8px), selección y pointer events bloqueados. */
  active?: boolean | undefined;
  children: ReactNode;
  style?: CSSProperties | undefined;
}

/** Envuelve montos para que el modo privacidad los pueda ocultar en público. */
export function PrivacyBlur({ active = false, children, style }: PrivacyBlurProps) {
  return (
    <span
      style={{
        display: "inline-block",
        filter: active ? "blur(8px)" : "none",
        userSelect: active ? "none" : "auto",
        pointerEvents: active ? "none" : "auto",
        transition: "filter var(--duration-base) var(--ease-spring-soft)",
        ...style,
      }}
      aria-hidden={active || undefined}
    >
      {children}
    </span>
  );
}
