"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, Icon, Sheet } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { useOnboardingHydrated, useOnboardingStore } from "@/stores/onboarding-store";
import { usePwaStore } from "@/stores/pwa-store";
import { detectInstallPlatform, isStandalonePwa, type InstallPlatform } from "@/lib/pwa/platform";

/**
 * A10 — instalar la PWA, último paso del onboarding, después del primer
 * ingreso y el primer gasto reales. El saldo inicial (A7) se eliminó del
 * flujo — queda editable desde la cuenta — así que esta pantalla ya no
 * pide nada de plata, solo ofrece instalar.
 */
export default function OnboardingCompletePage() {
  const t = useTranslations();
  const router = useRouter();
  const hydrated = useOnboardingHydrated();
  const firstTxStep = useOnboardingStore((s) => s.draft.firstTxStep);
  const reset = useOnboardingStore((s) => s.reset);
  const installPrompt = usePwaStore((s) => s.deferredPrompt);
  const setDeferredPrompt = usePwaStore((s) => s.setDeferredPrompt);
  const [installState, setInstallState] = useState<{ platform: InstallPlatform; standalone: boolean } | null>(null);
  const [installSheetOpen, setInstallSheetOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  const finish = () => {
    // Cierra la máquina de estados del primer movimiento: `firstTxStep`
    // vuelve a `null` junto con el resto del draft.
    reset();
    router.push("/");
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detección de UA/display-mode, no derivable en SSR.
    setInstallState({ platform: detectInstallPlatform(), standalone: isStandalonePwa() });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (firstTxStep !== "install") {
      router.replace("/");
      return;
    }
    // Ya instalada — nada que ofrecer (cubre tanto "la instaló antes" como
    // "abrió este onboarding desde dentro de la app ya instalada").
    if (installState?.standalone) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, firstTxStep, installState?.standalone]);

  if (!hydrated || firstTxStep !== "install" || installState?.standalone) return null;

  // Un solo botón resuelve la instalación de punta a punta donde el
  // navegador lo permite (Chrome/Edge en Android, Windows y macOS
  // disparan `beforeinstallprompt`, capturado en `pwa-store.ts`): tocarlo
  // ya deja la PWA instalada, sin pasos manuales. Donde no hay API
  // programática — iOS/iPadOS Safari nunca dispara ese evento, es una
  // restricción de Apple, no algo que este código pueda evitar — el mismo
  // botón abre la guía exacta para esa plataforma (`settingsPage.installGuide`,
  // ya escrita y probada en Ajustes → Instalar app; no se reinventa acá).
  const handleInstall = async () => {
    if (installPrompt) {
      if (installing) return;
      setInstalling(true);
      try {
        await installPrompt.prompt();
        await installPrompt.userChoice;
        setDeferredPrompt(null);
        finish();
      } finally {
        setInstalling(false);
      }
      return;
    }
    setInstallSheetOpen(true);
  };

  return (
    <ScreenShell style={{ alignItems: "center", justifyContent: "center", padding: "var(--screen-padding)", gap: 20, textAlign: "center" }}>
      <Icon name="install" size={40} color="var(--primary-ink)" />
      <h1 className="t-title" style={{ margin: 0 }}>{t("onboarding.complete.installTitle")}</h1>
      <p className="t-body" style={{ color: "var(--text-secondary)", maxWidth: "32ch" }}>
        {t("onboarding.complete.installSubtitle")}
      </p>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        <Button disabled={installing} onClick={handleInstall}>{t("onboarding.complete.install")}</Button>
        <Button variant="secondary" disabled={installing} onClick={() => { toast(t("onboarding.complete.laterToast")); finish(); }}>
          {t("onboarding.complete.later")}
        </Button>
      </div>
      <Sheet open={installSheetOpen} title={t("onboarding.complete.install")} onClose={() => setInstallSheetOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>
            {t(`settingsPage.installGuide.${installState?.platform ?? "other"}`)}
          </p>
          <Button
            onClick={() => {
              setInstallSheetOpen(false);
              finish();
            }}
          >
            {t("onboarding.complete.continue")}
          </Button>
        </div>
      </Sheet>
    </ScreenShell>
  );
}
