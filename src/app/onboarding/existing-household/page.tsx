"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Icon } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { signOut } from "@/lib/auth/sign-out";

/**
 * C7 — destino de `resolveOnboardingDestination()` cuando el usuario ya es
 * miembro de un household remoto pero este dispositivo no tiene sus datos
 * locales. No hay pull-sync todavía (BASE-05) — esta pantalla existe para
 * no dejar seguir a A4, que crearía un household duplicado en silencio. No
 * es una solución, es el freno hasta que el pull-sync exista.
 */
export default function ExistingHouseholdPage() {
  const t = useTranslations();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <ScreenShell style={{ alignItems: "center", justifyContent: "center", padding: "var(--screen-padding)", gap: 20, textAlign: "center" }}>
      <Icon name="alert" size={48} color="var(--text-secondary)" />
      <h1 className="t-title" style={{ margin: 0 }}>{t("onboarding.existingHousehold.title")}</h1>
      <p className="t-body" style={{ color: "var(--text-secondary)", maxWidth: "36ch" }}>
        {t("onboarding.existingHousehold.subtitle")}
      </p>
      <div style={{ width: "100%", marginTop: 16 }}>
        <Button size="lg" variant="secondary" disabled={signingOut} onClick={handleSignOut}>
          {signingOut ? t("onboarding.existingHousehold.signingOut") : t("onboarding.existingHousehold.signOut")}
        </Button>
      </div>
    </ScreenShell>
  );
}
