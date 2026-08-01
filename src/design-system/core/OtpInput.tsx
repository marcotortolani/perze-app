"use client";

import { useRef } from "react";
import type { ClipboardEvent, CSSProperties, KeyboardEvent } from "react";
import { useTranslations } from "next-intl";

export interface OtpInputProps {
  length?: number | undefined;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean | undefined;
  /** Mientras se verifica el código contra el servidor — no bloquea visualmente, solo evita doble submit. */
  disabled?: boolean | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Seis casillas de un dígito con autofill — código de verificación de A3.
 *
 * D9/auditoría: cada casilla era un `<input>` sin `aria-label` — un lector
 * de pantalla las anunciaba como seis campos de texto sin contexto ("editar
 * texto", sin más). Ahora cada una anuncia "dígito N de M" y el conjunto
 * lleva `role="group"` con un label que identifica el campo completo.
 *
 * Pegar el código: `onPaste` en cada casilla ya lo distribuye si el
 * usuario pega manualmente ahí (Ctrl+V o mantener presionado → Pegar),
 * pero eso no es descubrible — nada en pantalla sugiere que se puede pegar
 * en una casilla de un solo dígito. El botón "Pegar código" de abajo hace
 * lo mismo con un solo tap, vía `navigator.clipboard.readText()` — no
 * reemplaza el paste nativo (que sigue andando), lo hace visible.
 */
export function OtpInput({ length = 6, value, onChange, invalid = false, disabled = false, style }: OtpInputProps) {
  const t = useTranslations();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");
  const canPasteFromClipboard = typeof navigator !== "undefined" && !!navigator.clipboard?.readText;

  const applyPasted = (raw: string) => {
    const pasted = raw.replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted.padEnd(length, "").slice(0, length).trimEnd());
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  const setDigit = (i: number, d: string) => {
    const next = digits.slice();
    next[i] = d;
    onChange(next.join(""));
    if (d && i < length - 1) refs.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    applyPasted(e.clipboardData.getData("text"));
  };

  const handlePasteButton = async () => {
    try {
      const text = await navigator.clipboard.readText();
      applyPasted(text);
    } catch {
      // Permiso denegado o portapapeles vacío/no textual — el usuario
      // siempre puede seguir pegando a mano en una casilla.
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, ...style }}>
      <div role="group" aria-label={t("ds.otpInput.groupLabel")} style={{ display: "flex", gap: 8 }}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            aria-label={t("ds.otpInput.digitLabel", { index: i + 1, total: length })}
            aria-invalid={invalid || undefined}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            disabled={disabled}
            onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, "").slice(-1))}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={onPaste}
            style={{
              width: 44,
              height: 56,
              textAlign: "center",
              background: "var(--surface-3)",
              color: "var(--text-primary)",
              border: `1px solid ${invalid ? "var(--critical)" : "var(--border)"}`,
              borderRadius: "var(--radius-input)",
              fontFamily: "var(--font-mono)",
              fontVariantNumeric: "tabular-nums",
              fontSize: 22,
              fontWeight: 600,
              outline: "none",
            }}
          />
        ))}
      </div>
      {canPasteFromClipboard ? (
        <button
          type="button"
          onClick={handlePasteButton}
          disabled={disabled}
          style={{
            background: "none",
            border: 0,
            padding: "4px 8px",
            margin: "-4px -8px",
            cursor: disabled ? "default" : "pointer",
            color: "var(--primary-ink)",
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {t("ds.otpInput.pasteCode")}
        </button>
      ) : null}
    </div>
  );
}
