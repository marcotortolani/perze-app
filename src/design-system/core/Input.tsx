import { useId } from "react";
import type { ChangeEvent, CSSProperties, ElementType } from "react";

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
export function Input({ label, hint, invalid = false, multiline = false, style, id, ...rest }: InputProps) {
  const Tag: ElementType = multiline ? "textarea" : "input";
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
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
      <Tag
        {...rest}
        id={inputId}
        aria-invalid={invalid || undefined}
        aria-describedby={hintId}
        style={{
          width: "100%",
          minHeight: multiline ? 88 : 48,
          padding: multiline ? "12px 14px" : "0 14px",
          background: "var(--surface-3)",
          color: "var(--text-primary)",
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
