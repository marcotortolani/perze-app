"use client";

import { useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { Icon } from "../core/Icon";

export interface SelectableRowProps {
  label: string;
  meta?: ReactNode | undefined;
  selected: boolean;
  /** `false` (default) → `role="radio"`, un check excluyente. `true` → `role="checkbox"`. El agrupador es responsabilidad del caller (`role="radiogroup"` + su label). */
  multiple?: boolean | undefined;
  onChange: (next: boolean) => void;
  disabled?: boolean | undefined;
  style?: CSSProperties | undefined;
}

/**
 * `docs/contrato-componentes.md` § SelectableRow — especificado para A6/A8/
 * C2/K3/K5 pero nunca implementado (0 hits en `src/` antes de esto). Fase 2
 * de inversiones (elegir qué lote vender) es el primer caller real.
 *
 * Selección por superficie (`--selection-surface`/`--selection-ring`, no
 * `--surface-3` — ver el comentario largo en `globals.css`: `--surface-3`
 * también es inputs/keypad y no tiene contraste real contra `--surface-2`
 * en modo claro). `OptionCard` es el hermano grande (título + descripción);
 * esta es la fila angosta de lista.
 */
export function SelectableRow({ label, meta, selected, multiple = false, onChange, disabled = false, style }: SelectableRowProps) {
  const [pressed, setPressed] = useState(false);
  const role = multiple ? "checkbox" : "radio";

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onChange(!selected);
    }
  };

  return (
    <div
      role={role}
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onChange(!selected)}
      onKeyDown={handleKeyDown}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        minHeight: 56,
        padding: "10px 14px",
        borderRadius: "var(--radius-input)",
        border: `1px solid ${selected ? "var(--selection-ring)" : "transparent"}`,
        background: selected ? "var(--selection-surface)" : "var(--surface-2)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transform: pressed && !disabled ? "scale(var(--press-scale))" : "scale(1)",
        transition: "transform var(--duration-fast) var(--ease-spring-snappy), background var(--duration-fast) linear",
        ...style,
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", font: "400 16px/22px var(--font-sans)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        {meta ? <span style={{ display: "block", font: "500 13px/18px var(--font-sans)", color: "var(--text-muted)", marginTop: 1 }}>{meta}</span> : null}
      </span>
      {selected ? <Icon name="check" size={18} color="var(--primary-ink)" style={{ flexShrink: 0 }} /> : null}
    </div>
  );
}
