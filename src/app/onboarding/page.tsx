"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, Icon, Input, Logo } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { seedDemoHousehold } from "@/lib/seed/demo-household";
import { useInvalidateHousehold } from "@/hooks/use-current-household";

/**
 * A2 — auth. Sin backend real: Google/Apple simulan éxito inmediato (son el
 * camino visualmente principal, per el cierre del Bloque A); el magic link
 * por email es la alternativa y pasa por A3. Sin contraseña en ningún caso.
 */
export default function OnboardingAuthPage() {
  const t = useTranslations();
  const router = useRouter();
  const setField = useOnboardingStore((s) => s.setField);
  const invalidateHousehold = useInvalidateHousehold();
  const [email, setEmail] = useState("");
  const [seeding, setSeeding] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleOAuth = (provider: "Google" | "Apple") => {
    toast(t("onboarding.auth.connectedWith", { provider }));
    router.push("/onboarding/country");
  };

  const handleMagicLink = () => {
    if (!emailValid) return;
    setField("email", email);
    router.push("/onboarding/verify");
  };

  const handleDemo = async () => {
    setSeeding(true);
    try {
      await seedDemoHousehold();
      invalidateHousehold();
      router.push("/");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <ScreenShell style={{ padding: "48px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 32 }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ margin: 0 }}>
          <Logo style={{ fontSize: "var(--text-title-size)" }} />
        </h1>
        <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 8 }}>
          {t("onboarding.auth.tagline")}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: "auto" }}>
        <Button variant="secondary" icon="google" onClick={() => handleOAuth("Google")}>
          {t("onboarding.auth.continueWithGoogle")}
        </Button>
        <Button variant="secondary" icon="apple" onClick={() => handleOAuth("Apple")}>
          {t("onboarding.auth.continueWithApple")}
        </Button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("onboarding.auth.orWithEmail")}</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        <Input placeholder={t("onboarding.auth.emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button disabled={!emailValid} icon="mail" onClick={handleMagicLink}>
          {t("onboarding.auth.sendLink")}
        </Button>
      </div>

      <button
        type="button"
        onClick={handleDemo}
        disabled={seeding}
        style={{ background: "none", border: 0, cursor: "pointer", color: "var(--text-muted)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
      >
        <Icon name="eye" size={14} color="var(--text-muted)" />
        {seeding ? t("onboarding.auth.loadingDemo") : t("onboarding.auth.tryDemo")}
      </button>
    </ScreenShell>
  );
}
