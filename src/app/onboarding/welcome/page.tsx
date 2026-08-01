"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { markWelcomeSeen } from "@/lib/onboarding/welcome-flag";

/**
 * A1 — welcome, fuera del camino crítico. Se ofrece una sola vez, solo si
 * la app se abre sin sesión y sin household todavía (ver el gate en
 * `(app)/layout.tsx`); "Saltear" y "Empezar" llevan al mismo lado, A2.
 */
export default function OnboardingWelcomePage() {
  const t = useTranslations();
  const router = useRouter();

  const proceed = () => {
    markWelcomeSeen();
    router.push("/onboarding");
  };

  return (
    <ScreenShell style={{ padding: "0 var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 0 }}>
      <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        <button type="button" onClick={proceed} style={{ background: "none", border: 0, cursor: "pointer", color: "var(--text-secondary)", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500 }}>
          {t("onboarding.welcome.skip")}
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ height: 80 }} />
        <h1 className="t-hero-xl" style={{ margin: 0, maxWidth: "300px", textWrap: "pretty" }}>
          {t("onboarding.welcome.title")}
        </h1>
        <p className="t-body" style={{ margin: "16px 0 0", color: "var(--text-secondary)", maxWidth: "300px", textWrap: "pretty" }}>
          {t("onboarding.welcome.subtitle")}
        </p>
        <div style={{ height: 40 }} />
        <div
          style={{
            background: "var(--surface-1)",
            borderRadius: "var(--radius-card)",
            height: 280,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            color: "var(--text-muted)",
          }}
        >
          {t("onboarding.welcome.demoPlaceholder")}
        </div>

        <div style={{ marginTop: "auto", paddingBottom: 34, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            <span style={{ width: 24, height: 4, borderRadius: 999, background: "var(--text-primary)" }} />
            <span style={{ width: 8, height: 4, borderRadius: 999, background: "var(--border)" }} />
            <span style={{ width: 8, height: 4, borderRadius: 999, background: "var(--border)" }} />
          </div>
          <Button onClick={proceed}>{t("onboarding.welcome.start")}</Button>
        </div>
      </div>
    </ScreenShell>
  );
}
