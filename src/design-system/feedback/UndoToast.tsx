"use client";

import { useEffect } from "react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "../core/Icon";

export interface UndoToastProps {
  message: string;
  onUndo?: (() => void) | undefined;
  onDismiss?: (() => void) | undefined;
  /** 5s por defecto — la ventana que el sistema promete en vez de un diálogo de confirmación. */
  duration?: number | undefined;
  visible?: boolean | undefined;
  style?: CSSProperties | undefined;
}

/** Toast post-acción con Deshacer de 5s. Reemplaza los diálogos de confirmación en toda acción reversible. */
export function UndoToast({ message, onUndo, onDismiss, duration = 5000, visible = true, style }: UndoToastProps) {
  const t = useTranslations();
  useEffect(() => {
    if (!visible || !onDismiss) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [visible, duration, onDismiss]);

  if (!visible) return null;
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "var(--surface-3)",
        color: "var(--text-primary)",
        borderRadius: "var(--radius-button)",
        padding: "12px 12px 12px 16px",
        boxShadow: "var(--shadow-sheet)",
        ...style,
      }}
    >
      <Icon name="check" size={16} strokeWidth={2.2} color="var(--text-secondary)" />
      <span style={{ flex: 1, fontSize: 14, lineHeight: "20px" }}>{message}</span>
      <button
        type="button"
        onClick={onUndo}
        style={{ minHeight: 44, background: "none", border: 0, cursor: "pointer", color: "var(--primary-ink)", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500, padding: "0 4px" }}
      >
        {t("ds.undoToast.undo")}
      </button>
    </div>
  );
}
