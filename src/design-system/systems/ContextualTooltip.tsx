"use client";

import type { CSSProperties, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "../core/Icon";

export interface ContextualTooltipProps {
  message: string;
  onDismiss: () => void;
  /** Envuelve el elemento que el tooltip señala. */
  children: ReactNode;
  /** Lado donde aparece la burbuja respecto al elemento envuelto. */
  side?: "top" | "bottom";
  style?: CSSProperties;
}

/**
 * L5 — cómo se explica una feature nueva la primera vez, sin un tour
 * completo: un solo paso, descartable, nunca más de uno visible a la vez.
 * El estado "ya visto" lo persiste el consumidor (una key en `meta` de
 * Dexie o el store que corresponda) — este componente solo dibuja el paso.
 */
export function ContextualTooltip({ message, onDismiss, children, side = "bottom", style }: ContextualTooltipProps) {
  const t = useTranslations();
  return (
    <div style={{ position: "relative", display: "inline-block", ...style }}>
      {children}
      <div
        role="tooltip"
        style={{
          position: "absolute",
          [side === "bottom" ? "top" : "bottom"]: "calc(100% + 10px)",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          background: "var(--surface-3)",
          color: "var(--text-primary)",
          borderRadius: "var(--radius-input)",
          padding: "10px 12px",
          minWidth: 220,
          maxWidth: 280,
          boxShadow: "var(--shadow-sheet)",
          fontSize: 13,
          lineHeight: "18px",
        }}
      >
        <span style={{ flex: 1 }}>{message}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("ds.contextualTooltip.gotIt")}
          style={{ background: "none", border: 0, padding: 2, margin: -2, cursor: "pointer", flexShrink: 0 }}
        >
          <Icon name="close" size={14} color="var(--text-muted)" />
        </button>
      </div>
    </div>
  );
}
