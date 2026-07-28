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

/** Campo de texto sobre superficie 3, radio 14, 48px de alto. NUNCA para montos — eso es el Keypad. */
export function Input({ label, hint, invalid = false, multiline = false, style, ...rest }: InputProps) {
  const Tag: ElementType = multiline ? "textarea" : "input";
  return (
    <label style={{ display: "block" }}>
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
