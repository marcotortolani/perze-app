"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { IconButton, OtpInput, ZMark } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { createClient } from "@/lib/supabase/client";

/** B10 — el mismo cooldown que la Edge Function ya exige del lado servidor (rate limit de `signInWithOtp`); acá es solo para no dejar tocar "Reenviar" en loop y quemar los reintentos sin que el usuario se entere por qué. */
const RESEND_COOLDOWN_SECONDS = 60;

/** A3 — verificación del código de 6 dígitos que manda `signInWithOtp` (A2). */
export default function OnboardingVerifyPage() {
  const t = useTranslations();
  const router = useRouter();
  const email = useOnboardingStore((s) => s.draft.email);
  const [code, setCode] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [verifying, setVerifying] = useState(false);
  // Arranca en cooldown: llegar acá ya implica que se mandó un código recién (A2).
  // `handleResend` lo vuelve a poner en `RESEND_COOLDOWN_SECONDS` directo
  // (evento de usuario, no un efecto) — el único trabajo del efecto es
  // tickear cada segundo, sin volver a sincronizar nada externo.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    const timer = setInterval(() => {
      setCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleChange = async (value: string) => {
    setCode(value);
    setInvalid(false);
    if (value.length !== 6) return;
    if (!/^\d{6}$/.test(value)) {
      setInvalid(true);
      return;
    }

    setVerifying(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({ email, token: value, type: "email" });
      if (error) {
        setInvalid(true);
        return;
      }
      router.push("/onboarding/country");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) toast.error(error.message);
    else {
      toast(t("onboarding.verify.resent"));
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  };

  return (
    <ScreenShell style={{ padding: "48px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 32 }}>
      <IconButton icon="chevron-left" ariaLabel={t("onboarding.verify.back")} onClick={() => router.push("/onboarding")} style={{ alignSelf: "flex-start", margin: -11 }} />

      <div style={{ textAlign: "center" }}>
        <h1 className="t-title" style={{ margin: 0 }}>{t("onboarding.verify.title")}</h1>
        <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 8 }}>
          {t.rich("onboarding.verify.sentTo", { email: email || t("onboarding.verify.yourEmail"), b: (chunks) => <strong>{chunks}</strong> })}
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <OtpInput value={code} onChange={handleChange} invalid={invalid} disabled={verifying} />
      </div>
      {invalid ? (
        <p className="t-label" style={{ color: "var(--critical)", textAlign: "center" }}>
          {t("onboarding.verify.invalidCode")}
        </p>
      ) : null}
      {verifying ? (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <ZMark size={10} gap={3} animated variant="sweep" aria-label={t("app.name")} />
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", marginTop: "auto" }}>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0}
          style={{ background: "none", border: 0, cursor: cooldown > 0 ? "default" : "pointer", color: cooldown > 0 ? "var(--text-muted)" : "var(--primary-ink)", fontSize: 14 }}
        >
          {cooldown > 0 ? t("onboarding.verify.resendCooldown", { seconds: cooldown }) : t("onboarding.verify.resend")}
        </button>
        <button type="button" onClick={() => router.push("/onboarding")} style={{ background: "none", border: 0, cursor: "pointer", color: "var(--text-muted)", fontSize: 14 }}>
          {t("onboarding.verify.changeEmail")}
        </button>
      </div>
    </ScreenShell>
  );
}
