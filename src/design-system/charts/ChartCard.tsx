"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../core/Icon";

export interface ChartCardProps {
  title: string;
  controls?: ReactNode | undefined;
  legend?: ReactNode | undefined;
  footnote?: ReactNode | undefined;
  /** Sin controlar (`view`/`onViewChange` ausentes), el toggle queda en estado propio — nunca ausente: es lo que este componente garantiza. */
  view?: "chart" | "table" | undefined;
  onViewChange?: ((view: "chart" | "table") => void) | undefined;
  /** El gráfico (`view === "chart"`). */
  children: ReactNode;
  /** La tabla equivalente (`view === "table"`, típicamente un `DataList`). */
  table: ReactNode;
  /** Labels del toggle — el caller los resuelve vía `useTranslations`, igual que `dismissLabel` en `DismissibleNotice`. */
  chartLabel: string;
  tableLabel: string;
  style?: CSSProperties | undefined;
}

/**
 * Envuelve todo gráfico del sistema — garantiza que el toggle "ver como
 * tabla" exista siempre (regla de `docs/02-design-system.md` § 7), en vez
 * de quedar a criterio de cada pantalla. Superficie 1, radio 20, sin
 * borde ni sombra — los mismos tokens que `Card`.
 */
export function ChartCard({ title, controls, legend, footnote, view, onViewChange, children, table, chartLabel, tableLabel, style }: ChartCardProps) {
  const [internalView, setInternalView] = useState<"chart" | "table">("chart");
  const activeView = view ?? internalView;
  const setView = (v: "chart" | "table") => {
    onViewChange?.(v);
    if (view === undefined) setInternalView(v);
  };

  return (
    <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 20, ...style }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span className="t-caption" style={{ color: "var(--text-muted)", textTransform: "uppercase" }}>
          {title}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {controls}
          {/* Selección por superficie, nunca violeta — ese color queda para
              la acción primaria de la pantalla (CLAUDE.md, "un solo violeta
              visible"). */}
          <div style={{ display: "flex", background: "var(--surface-2)", borderRadius: "var(--radius-chip)", padding: 2, gap: 2 }}>
            <button
              type="button"
              aria-pressed={activeView === "chart"}
              aria-label={chartLabel}
              onClick={() => setView("chart")}
              style={toggleButtonStyle(activeView === "chart")}
            >
              <Icon name="trend" size={15} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-pressed={activeView === "table"}
              aria-label={tableLabel}
              onClick={() => setView("table")}
              style={toggleButtonStyle(activeView === "table")}
            >
              <Icon name="list" size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>{activeView === "chart" ? children : table}</div>

      {legend ? <div style={{ marginTop: 12 }}>{legend}</div> : null}
      {footnote ? (
        <div className="t-caption" style={{ marginTop: 12, color: "var(--text-muted)" }}>
          {footnote}
        </div>
      ) : null}
    </div>
  );
}

function toggleButtonStyle(active: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    border: 0,
    borderRadius: "var(--radius-chip)",
    cursor: "pointer",
    background: active ? "var(--surface-3)" : "transparent",
    color: active ? "var(--text-primary)" : "var(--text-muted)",
    transition: "background var(--duration-fast) linear, color var(--duration-fast) linear",
  };
}
