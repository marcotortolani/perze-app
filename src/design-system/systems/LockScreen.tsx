"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "../core/Icon";
import { PinKeypad } from "../money/PinKeypad";

export interface LockScreenProps {
  /** Se llama con el PIN completo cuando llega al largo esperado. Devuelve `false` si es incorrecto. */
  onSubmit: (pin: string) => boolean | Promise<boolean>;
  onBiometric?: (() => void) | undefined;
  pinLength?: number;
  /**
   * Segundos restantes de bloqueo tras 3 intentos errados (0 = sin
   * bloqueo). Mientras es > 0 el keypad no dibuja teclas: nunca se borran
   * datos, solo se espera.
   */
  lockoutSeconds?: number;
  style?: CSSProperties;
}

/**
 * L6 — el gate de PIN/biometría al abrir la app. Opcional y apagado por
 * defecto (`docs/03-prompts-wireframes.md` § L6). **Esta pantalla nunca
 * se interpone entre el usuario y C1/C2**: el shortcut de la PWA, el
 * share target y el widget entran directo al keypad de captura sin pasar
 * por acá. El gate solo aparece al querer VER saldos, movimientos o
 * análisis — escribir no revela nada, leer sí.
 */
export function LockScreen({ onSubmit, onBiometric, pinLength = 6, lockoutSeconds = 0, style }: LockScreenProps) {
  const t = useTranslations();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const locked = lockoutSeconds > 0;

  const handleKey = async (key: string) => {
    if (locked) return;
    if (key === "backspace") {
      setPin((p) => p.slice(0, -1));
      setError(false);
      return;
    }
    if (pin.length >= pinLength) return;

    const next = pin + key;
    setPin(next);
    setError(false);

    if (next.length === pinLength) {
      const ok = await onSubmit(next);
      if (!ok) {
        setError(true);
        setPin("");
      }
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        minHeight: "100svh",
        padding: "48px var(--screen-padding)",
        ...style,
      }}
    >
      <Icon name="lock" size={28} strokeWidth={1.5} color="var(--text-secondary)" />
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>{t("ds.lockScreen.enterPin")}</p>
        {locked ? (
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--critical)", maxWidth: "32ch" }}>{t("ds.lockScreen.lockedOut", { seconds: lockoutSeconds })}</p>
        ) : error ? (
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--critical)" }}>{t("ds.lockScreen.wrongPin")}</p>
        ) : null}
      </div>
      {!locked ? <PinKeypad length={pin.length} maxLength={pinLength} onKey={handleKey} style={{ width: "100%", maxWidth: 320 }} /> : null}
      {onBiometric && !locked ? (
        <button
          type="button"
          onClick={onBiometric}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: 0, cursor: "pointer", color: "var(--primary-ink)", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500 }}
        >
          <Icon name="fingerprint" size={18} />
          {t("ds.lockScreen.useBiometrics")}
        </button>
      ) : null}
    </div>
  );
}
