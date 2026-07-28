import type { CSSProperties, ReactNode } from "react";

export interface ResultGroupProps {
  label: string;
  count?: number | undefined;
  onSeeAll?: (() => void) | undefined;
  /** Requerido cuando `onSeeAll` está presente — lo resuelve el caller vía `useTranslations`. */
  seeAllLabel?: string | undefined;
  children: ReactNode;
  style?: CSSProperties | undefined;
}

/** Header de grupo con label, contador y "ver todos" — resultados de búsqueda (B8), secciones de lista (D1). */
export function ResultGroup({ label, count, onSeeAll, seeAllLabel, children, style }: ResultGroupProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 0 4px" }}>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            lineHeight: "16px",
            fontWeight: 600,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          {label}
          {count !== undefined ? ` · ${count}` : ""}
        </span>
        {onSeeAll ? (
          <button
            type="button"
            onClick={onSeeAll}
            style={{ background: "none", border: 0, cursor: "pointer", padding: 0, color: "var(--primary-ink)", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500 }}
          >
            {seeAllLabel}
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}
