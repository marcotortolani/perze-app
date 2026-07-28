"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Icon, OtpInput } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { useOnboardingStore } from "@/stores/onboarding-store";

/** A3 — verificación de magic link. Sin backend: cualquier código de 6 dígitos se acepta. */
export default function OnboardingVerifyPage() {
  const t = useTranslations();
  const router = useRouter();
  const email = useOnboardingStore((s) => s.draft.email);
  const [code, setCode] = useState("");
  const [invalid, setInvalid] = useState(false);

  const handleChange = (value: string) => {
    setCode(value);
    setInvalid(false);
    if (value.length === 6) {
      if (/^\d{6}$/.test(value)) router.push("/onboarding/country");
      else setInvalid(true);
    }
  };

  return (
    <ScreenShell style={{ padding: "48px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 32 }}>
      <button type="button" onClick={() => router.push("/onboarding")} aria-label={t("onboarding.verify.back")} style={{ alignSelf: "flex-start", background: "none", border: 0, padding: 4, margin: -4, cursor: "pointer" }}>
        <Icon name="chevron-left" size={22} color="var(--text-secondary)" />
      </button>

      <div style={{ textAlign: "center" }}>
        <h1 className="t-title" style={{ margin: 0 }}>{t("onboarding.verify.title")}</h1>
        <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 8 }}>
          {t.rich("onboarding.verify.sentTo", { email: email || t("onboarding.verify.yourEmail"), b: (chunks) => <strong>{chunks}</strong> })}
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <OtpInput value={code} onChange={handleChange} invalid={invalid} />
      </div>
      {invalid ? (
        <p className="t-label" style={{ color: "var(--critical)", textAlign: "center" }}>
          {t("onboarding.verify.invalidCode")}
        </p>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", marginTop: "auto" }}>
        <button type="button" onClick={() => toast(t("onboarding.verify.resent"))} style={{ background: "none", border: 0, cursor: "pointer", color: "var(--primary-ink)", fontSize: 14 }}>
          {t("onboarding.verify.resend")}
        </button>
        <button type="button" onClick={() => router.push("/onboarding")} style={{ background: "none", border: 0, cursor: "pointer", color: "var(--text-muted)", fontSize: 14 }}>
          {t("onboarding.verify.changeEmail")}
        </button>
      </div>
    </ScreenShell>
  );
}
