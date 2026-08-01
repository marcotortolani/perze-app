"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AppHeader, Icon, PinKeypad, Switch } from "@/design-system";
import { usePinStore } from "@/stores/pin-store";

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
  const [step, setStep] = useState<"idle" | "create" | "confirm">("idle");
  const [firstPin, setFirstPin] = useState("");
  const [pin, setPinDigits] = useState("");
  const [mismatch, setMismatch] = useState(false);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("securityPage.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 16, gap: 20 }}>
        {step === "idle" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 4px" }}>
            <Icon name="lock" size={20} color="var(--text-secondary)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, color: "var(--text-primary)" }}>{t("securityPage.pinLock")}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t("securityPage.pinLockDescription")}</div>
            </div>
            <Switch checked={enabled} onChange={handleToggle} id="pin-lock-switch" />
          </div>
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
    </div>
  );
}
