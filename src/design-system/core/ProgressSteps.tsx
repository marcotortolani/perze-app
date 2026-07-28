import type { CSSProperties } from "react";

export interface ProgressStepsProps {
  /** Paso actual, 1-indexado. */
  current: number;
  total: number;
  onSkip?: (() => void) | undefined;
  /** Requerido cuando `onSkip` está presente — lo resuelve el caller vía `useTranslations`. */
  skipLabel?: string | undefined;
  style?: CSSProperties | undefined;
}

/** Barra de progreso de onboarding: segmentos de 3px, con "Saltear" siempre disponible — `docs/03-prompts-wireframes.md` § A4-A9. */
export function ProgressSteps({ current, total, onSkip, skipLabel, style }: ProgressStepsProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, ...style }}>
      <div style={{ flex: 1, display: "flex", gap: 4 }}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 999,
              background: i < current ? "var(--primary-fill)" : "var(--surface-3)",
              transition: "background var(--duration-base) var(--ease-spring-soft)",
            }}
          />
        ))}
      </div>
      {onSkip ? (
        <button
          type="button"
          onClick={onSkip}
          style={{ background: "none", border: 0, cursor: "pointer", padding: "4px 0", color: "var(--text-muted)", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500 }}
        >
          {skipLabel}
        </button>
      ) : null}
    </div>
  );
}
