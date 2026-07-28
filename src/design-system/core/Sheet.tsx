import type { CSSProperties, ReactNode } from "react";

export interface SheetProps {
  open?: boolean | undefined;
  title?: string | undefined;
  children?: ReactNode | undefined;
  /** Tap en el backdrop / drag-to-dismiss. */
  onClose?: (() => void) | undefined;
  height?: number | string | undefined;
  style?: CSSProperties | undefined;
}

/** Bottom sheet: superficie 2, radio 28 arriba, agarradera, scrim al 60%. Sheets y el FAB son los únicos elementos con sombra. */
export function Sheet({ open = true, title, children, onClose, height = "auto", style }: SheetProps) {
  if (!open) return null;
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "var(--scrim)", transition: "opacity var(--duration-slow) var(--ease-spring-soft)" }}
      />
      <section
        style={{
          position: "relative",
          background: "var(--surface-2)",
          borderRadius: "var(--radius-sheet) var(--radius-sheet) 0 0",
          boxShadow: "var(--shadow-sheet)",
          padding: "10px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))",
          height,
          ...style,
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 999, background: "var(--border)", margin: "0 auto 14px" }} />
        {title ? (
          <h2
            style={{
              margin: "0 0 16px",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-title-size)",
              lineHeight: "var(--text-title-line)",
              fontWeight: 600,
              letterSpacing: "var(--text-title-track)",
            }}
          >
            {title}
          </h2>
        ) : null}
        {children}
      </section>
    </div>
  );
}
