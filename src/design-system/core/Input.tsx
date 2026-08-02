"use client";

import { useId, useState } from "react";
import type { ChangeEvent, CSSProperties, ElementType } from "react";
import { IconButton } from "./IconButton";

export interface InputProps {
  label?: string | undefined;
  hint?: string | undefined;
  invalid?: boolean | undefined;
  multiline?: boolean | undefined;
  placeholder?: string | undefined;
  value?: string | undefined;
  onChange?: ((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void) | undefined;
  style?: CSSProperties | undefined;
  name?: string | undefined;
  id?: string | undefined;
  maxLength?: number | undefined;
  autoFocus?: boolean | undefined;
  /** `"password"` para contraseñas (§1, acceso controlado) — nunca para montos, eso sigue siendo el Keypad. Default `"text"`. */
  type?: "text" | "email" | "password" | undefined;
  autoComplete?: string | undefined;
  /** Campo mostrado pero no editable (p. ej. el email en `/onboarding/register`, ya fijado por la sesión). Texto en `--text-secondary` sobre `--surface-2` para leerse como apagado, no como error. */
  readOnly?: boolean | undefined;
  disabled?: boolean | undefined;
  /** Solo con `type="password"` — agrega el botón ver/ocultar (target 44×44) exigido por cualquier campo de contraseña del flujo de acceso controlado. */
  revealable?: boolean | undefined;
  revealLabels?: { show: string; hide: string } | undefined;
}

/**
 * Campo de texto sobre superficie 3, radio 14, 48px de alto. NUNCA para
 * montos — eso es el Keypad.
 *
 * D8/auditoría: el `hint` (sobre todo cuando `invalid`) no tenía ninguna
 * asociación programática con el control — un lector de pantalla no lo
 * anunciaba ni al enfocar el campo ni al aparecer el error. `aria-describedby`
 * lo liga siempre que hay hint; `aria-invalid` marca el estado; `role="alert"`
 * en el hint solo cuando `invalid` (un hint normal no es una alerta — se
 * leería como interrupción cada vez que aparece sin que haya pasado nada).
 */
export function Input({ label, hint, invalid = false, multiline = false, style, id, readOnly = false, disabled = false, revealable = false, revealLabels, type = "text", ...rest }: InputProps) {
  const Tag: ElementType = multiline ? "textarea" : "input";
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  // Solo tiene efecto si `revealable` && `type === "password"` — para
  // cualquier otro campo el estado queda sin usar.
  const [revealed, setRevealed] = useState(false);
  const canReveal = revealable && type === "password";
  return (
    <label style={{ display: "block" }} htmlFor={inputId}>
      {label ? (
        <span
          style={{
            display: "block",
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-secondary)",
            marginBottom: 8,
          }}
        >
          {label}
        </span>
      ) : null}
      <div style={{ position: "relative" }}>
        <Tag
          {...rest}
          type={canReveal && revealed ? "text" : type}
          id={inputId}
          readOnly={readOnly}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={hintId}
          style={{
            width: "100%",
            minHeight: multiline ? 88 : 48,
            padding: multiline ? "12px 14px" : `0 ${canReveal ? 44 : 14}px 0 14px`,
            background: readOnly || disabled ? "var(--surface-2)" : "var(--surface-3)",
            color: readOnly || disabled ? "var(--text-secondary)" : "var(--text-primary)",
            border: `1px solid ${invalid ? "var(--critical)" : "var(--border)"}`,
            borderRadius: "var(--radius-input)",
            fontFamily: "var(--font-sans)",
            fontSize: 16,
            lineHeight: "24px",
            outline: "none",
            resize: multiline ? "vertical" : undefined,
            ...style,
          }}
        />
        {canReveal ? (
          <IconButton
            icon={revealed ? "eye-off" : "eye"}
            ariaLabel={revealed ? (revealLabels?.hide ?? "Ocultar contraseña") : (revealLabels?.show ?? "Mostrar contraseña")}
            onClick={() => setRevealed((v) => !v)}
            size={40}
            iconSize={18}
            style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)" }}
          />
        ) : null}
      </div>
      {hint ? (
        <span
          id={hintId}
          role={invalid ? "alert" : undefined}
          style={{
            display: "block",
            fontSize: 12,
            color: invalid ? "var(--critical)" : "var(--text-muted)",
            marginTop: 6,
          }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}
