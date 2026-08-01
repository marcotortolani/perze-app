"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AppHeader, Button, Icon, Input, PinKeypad, Sheet, Switch } from "@/design-system";
import { usePinStore } from "@/stores/pin-store";
import { setOwnPassword } from "@/features/auth/password-auth";
import { isBiometricAvailable, registerBiometric } from "@/lib/security/webauthn";

const PIN_LENGTH = 6;

// Mismo criterio que `password_requirements = lower_upper_letters_digits`
// en `config.toml` (E15/E16) — validar acá evita el viaje de red solo para
// enterarse de que falta un dígito.
const PASSWORD_VALID = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

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
  const biometricEnabled = usePinStore((s) => s.biometricEnabled);
  const enableBiometric = usePinStore((s) => s.enableBiometric);
  const disableBiometric = usePinStore((s) => s.disableBiometric);
  const [step, setStep] = useState<"idle" | "create" | "confirm">("idle");
  const [firstPin, setFirstPin] = useState("");
  const [pin, setPinDigits] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [enrollingBiometric, setEnrollingBiometric] = useState(false);

  useEffect(() => {
    void isBiometricAvailable().then(setBiometricSupported);
  }, []);

  const handleToggle = (on: boolean) => {
    if (on) {
      setStep("create");
      setPinDigits("");
      setMismatch(false);
    } else {
      disable();
    }
  };

  const handleKey = async (key: string) => {
    if (key === "backspace") {
      setPinDigits((p) => p.slice(0, -1));
      setMismatch(false);
      return;
    }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPinDigits(next);
    if (next.length !== PIN_LENGTH) return;

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

  const handleOpenPasswordSheet = () => {
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setPasswordSheetOpen(true);
  };

  const handleSavePassword = async () => {
    if (savingPassword) return;
    if (!PASSWORD_VALID.test(newPassword)) {
      setPasswordError(t("securityPage.passwordRequirements"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("securityPage.passwordMismatch"));
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await setOwnPassword(newPassword);
      if (error) {
        setPasswordError(error);
        return;
      }
      setPasswordSheetOpen(false);
      toast(t("securityPage.passwordSaved"));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("securityPage.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
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

            <button
              type="button"
              onClick={handleOpenPasswordSheet}
              style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 4px", background: "none", border: 0, cursor: "pointer", textAlign: "left", width: "100%" }}
            >
              <Icon name="lock" size={20} color="var(--text-secondary)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, color: "var(--text-primary)" }}>{t("securityPage.password")}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t("securityPage.passwordDescription")}</div>
              </div>
            </button>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <p className="t-body" style={{ margin: 0, color: "var(--text-primary)", textAlign: "center" }}>
              {step === "create" ? t("securityPage.createPrompt") : t("securityPage.confirmPrompt")}
            </p>
            {mismatch ? <p style={{ margin: 0, fontSize: 13, color: "var(--critical)" }}>{t("securityPage.mismatch")}</p> : null}
            <PinKeypad length={pin.length} maxLength={PIN_LENGTH} onKey={handleKey} style={{ width: "100%", maxWidth: 320 }} />
          </div>
        )}
      </div>

      <Sheet open={passwordSheetOpen} title={t("securityPage.password")} onClose={() => setPasswordSheetOpen(false)} height={420}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input
            type="password"
            autoComplete="new-password"
            label={t("securityPage.newPassword")}
            value={newPassword}
            invalid={!!passwordError}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setPasswordError(null);
            }}
          />
          <Input
            type="password"
            autoComplete="new-password"
            label={t("securityPage.confirmPassword")}
            value={confirmPassword}
            invalid={!!passwordError}
            hint={passwordError ?? t("securityPage.passwordRequirements")}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setPasswordError(null);
            }}
          />
          <Button size="lg" disabled={savingPassword} onClick={handleSavePassword}>
            {savingPassword ? t("securityPage.savingPassword") : t("securityPage.savePassword")}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
