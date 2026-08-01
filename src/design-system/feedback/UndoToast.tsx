"use client";

import { useEffect, useState } from "react";
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
  /**
   * CON-17: `progress` es para operaciones sin deshacer (ej. una sincronización
   * en curso) — no dibuja el botón de acción, solo un contador y una barra de
   * 2px que se vacía en `duration`. `action` (default) es el Deshacer de siempre.
   */
  variant?: "action" | "progress" | undefined;
  style?: CSSProperties | undefined;
}

/** Toast post-acción con Deshacer de 5s, o de progreso sin acción (CON-17). */
export function UndoToast({ message, onUndo, onDismiss, duration = 5000, visible = true, variant = "action", style }: UndoToastProps) {
  const t = useTranslations();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!visible || variant !== "progress") return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      setElapsed(Math.min(now - start, duration));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, duration, variant]);

  useEffect(() => {
    if (!visible || !onDismiss) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onDismiss]);

  if (!visible) return null;
  const remainingSeconds = Math.max(0, Math.ceil((duration - elapsed) / 1000));

  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: variant === "progress" ? 8 : 0,
        background: "var(--surface-3)",
        color: "var(--text-primary)",
        borderRadius: "var(--radius-button)",
        padding: "12px 12px 12px 16px",
        boxShadow: "var(--shadow-sheet)",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Icon name="check" size={16} strokeWidth={2.2} color="var(--text-secondary)" />
        <span style={{ flex: 1, fontSize: 14, lineHeight: "20px" }}>{message}</span>
        {variant === "action" ? (
          <button
            type="button"
            onClick={onUndo}
            style={{ minHeight: 44, background: "none", border: 0, cursor: "pointer", color: "var(--primary-ink)", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500, padding: "0 4px" }}
          >
            {t("ds.undoToast.undo")}
          </button>
        ) : (
          <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 13, color: "var(--text-muted)" }}>
            {t("ds.undoToast.progressSeconds", { seconds: remainingSeconds })}
          </span>
        )}
      </div>
      {variant === "progress" ? (
        <div style={{ height: 2, borderRadius: 1, background: "var(--surface-2)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${100 - (elapsed / duration) * 100}%`,
              background: "var(--text-muted)",
              transition: "width 100ms linear",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
