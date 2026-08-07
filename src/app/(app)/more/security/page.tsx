"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Icon, PinKeypad, Switch, usePageHeader } from "@/design-system";
import { usePinStore } from "@/stores/pin-store";
import { isBiometricAvailable, registerBiometric } from "@/lib/security/webauthn";

const PIN_LENGTH = 6;

/**
 * L6 (ajustes) — activar/desactivar el bloqueo por PIN. Apagado por
 * defecto (CLAUDE.md § PIN); acá es donde se prende y se define el PIN.
 */
export default function SecurityPage() {
  const t = useTranslations();
  const router = useRouter();
  const enabled = usePinStore((s) => s.enabled);
  const setPin = usePinStore((s) => s.setPin);
  const disable = usePinStore((s) => s.disable);
  const verify = usePinStore((s) => s.verify);
  const lockedUntil = usePinStore((s) => s.lockedUntil);
  const lockoutSecondsRemaining = usePinStore((s) => s.lockoutSecondsRemaining);
  const biometricEnabled = usePinStore((s) => s.biometricEnabled);
  const enableBiometric = usePinStore((s) => s.enableBiometric);
  const disableBiometric = usePinStore((s) => s.disableBiometric);
  const [step, setStep] = useState<"idle" | "create" | "confirm" | "disable">("idle");
  const [firstPin, setFirstPin] = useState("");
  const [pin, setPinDigits] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const [disableError, setDisableError] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [enrollingBiometric, setEnrollingBiometric] = useState(false);
  usePageHeader({ title: t("securityPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  useEffect(() => {
    void isBiometricAvailable().then(setBiometricSupported);
  }, []);

  // Mismo criterio de espera que `PinGate`/`LockScreen`: mientras dura el
  // bloqueo de 3 intentos, el keypad no dibuja teclas — el tick solo corre
  // durante el paso de desactivación, no todo el tiempo que la pantalla
  // está montada. El valor inicial se lee al entrar a este paso (en
  // `handleToggle`), no acá, para no llamar `setState` de forma síncrona
  // dentro del cuerpo del efecto.
  useEffect(() => {
    if (step !== "disable") return;
    const interval = setInterval(() => setLockoutSeconds(lockoutSecondsRemaining()), 1000);
    return () => clearInterval(interval);
  }, [step, lockedUntil, lockoutSecondsRemaining]);

  const handleToggle = (on: boolean) => {
    if (on) {
      setStep("create");
      setPinDigits("");
      setMismatch(false);
    } else {
      // No cualquiera con el teléfono desbloqueado puede apagar la
      // protección: hace falta el PIN correcto, mismo gate que pedirlo
      // desbloquea la app — `disable()` recién se llama si `verify()` da ok.
      setStep("disable");
      setPinDigits("");
      setDisableError(false);
      setLockoutSeconds(lockoutSecondsRemaining());
    }
  };

  const handleKey = async (key: string) => {
    if (step === "disable" && lockoutSeconds > 0) return;
    // El mensaje de "no coinciden"/"incorrecto" se limpia apenas se toca
    // una tecla, no solo con backspace — antes quedaba pegado en pantalla
    // durante todo el reintento (el usuario ya estaba tipeando de nuevo y
    // seguía viendo el error de la vez anterior, como si algo siguiera mal).
    setMismatch(false);
    setDisableError(false);
    if (key === "backspace") {
      setPinDigits((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPinDigits(next);
    if (next.length !== PIN_LENGTH) return;

    if (step === "disable") {
      const ok = await verify(next);
      if (ok) {
        disable();
        setStep("idle");
        setPinDigits("");
        toast(t("securityPage.pinDisabled"));
      } else {
        setDisableError(true);
        setPinDigits("");
        setLockoutSeconds(lockoutSecondsRemaining());
      }
      return;
    }

    if (step === "create") {
      setFirstPin(next);
      setStep("confirm");
      setPinDigits("");
      return;
    }

    if (next === firstPin) {
      await setPin(next);
      setStep("idle");
      setPinDigits("");
      toast(t("securityPage.pinSet"));
    } else {
      setMismatch(true);
      setPinDigits("");
    }
  };

  const handleToggleBiometric = async (on: boolean) => {
    if (!on) {
      disableBiometric();
      return;
    }
    setEnrollingBiometric(true);
    try {
      const credentialId = await registerBiometric("PERZE device lock");
      enableBiometric(credentialId);
      toast(t("securityPage.biometricEnabled"));
    } catch {
      toast.error(t("securityPage.biometricEnrollError"));
    } finally {
      setEnrollingBiometric(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 16, gap: 20 }}>
        {step === "idle" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 4px" }}>
              <Icon name="lock" size={20} color="var(--text-secondary)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, color: "var(--text-primary)" }}>{t("securityPage.pinLock")}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t("securityPage.pinLockDescription")}</div>
              </div>
              <Switch checked={enabled} onChange={handleToggle} id="pin-lock-switch" />
            </div>

            {enabled && biometricSupported ? (
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 4px" }}>
                <Icon name="fingerprint" size={20} color="var(--text-secondary)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, color: "var(--text-primary)" }}>{t("securityPage.biometricLock")}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t("securityPage.biometricLockDescription")}</div>
                </div>
                <Switch checked={biometricEnabled} onChange={handleToggleBiometric} disabled={enrollingBiometric} id="biometric-lock-switch" />
              </div>
            ) : null}
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <p className="t-body" style={{ margin: 0, color: "var(--text-primary)", textAlign: "center" }}>
              {step === "create" ? t("securityPage.createPrompt") : step === "confirm" ? t("securityPage.confirmPrompt") : t("securityPage.disablePrompt")}
            </p>
            {mismatch ? <p style={{ margin: 0, fontSize: 13, color: "var(--critical)" }}>{t("securityPage.mismatch")}</p> : null}
            {step === "disable" && lockoutSeconds > 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--critical)", textAlign: "center", maxWidth: "32ch" }}>{t("ds.lockScreen.lockedOut", { seconds: lockoutSeconds })}</p>
            ) : step === "disable" && disableError ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--critical)" }}>{t("ds.lockScreen.wrongPin")}</p>
            ) : null}
            {step === "disable" && lockoutSeconds > 0 ? null : (
              <PinKeypad length={pin.length} maxLength={PIN_LENGTH} onKey={handleKey} style={{ width: "100%", maxWidth: 320 }} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
