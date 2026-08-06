"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Button, Icon, Keypad, Sheet } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { useOnboardingHydrated, useOnboardingStore } from "@/stores/onboarding-store";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccount, useInvalidateAccounts } from "@/hooks/use-accounts";
import { accountsRepo } from "@/lib/repos/accounts-repo";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import { numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";
import { usePwaStore } from "@/stores/pwa-store";
import { detectInstallPlatform, isStandalonePwa, type InstallPlatform } from "@/lib/pwa/platform";

/**
 * A7 + A10 — fuera del camino crítico: se piden acá, después del primer
 * gasto real (`docs/03-prompts-wireframes.md` § A7/A10). El primer contacto
 * de verdad con el keypad ya pasó en C1; esto solo completa el saldo.
 */
export default function OnboardingCompletePage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const hydrated = useOnboardingHydrated();
  const pendingBalanceAccountId = useOnboardingStore((s) => s.draft.pendingBalanceAccountId);
  const reset = useOnboardingStore((s) => s.reset);
  const { data: account } = useAccount(pendingBalanceAccountId ?? undefined);
  const invalidateAccounts = useInvalidateAccounts(household?.id);
  const [step, setStep] = useState<"balance" | "install">("balance");
  const [expr, setExpr] = useState("");
  const installPrompt = usePwaStore((s) => s.deferredPrompt);
  const setDeferredPrompt = usePwaStore((s) => s.setDeferredPrompt);
  const [installState, setInstallState] = useState<{ platform: InstallPlatform; standalone: boolean } | null>(null);
  const [installSheetOpen, setInstallSheetOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detección de UA/display-mode, no derivable en SSR.
    setInstallState({ platform: detectInstallPlatform(), standalone: isStandalonePwa() });
  }, []);

  useEffect(() => {
    if (hydrated && !pendingBalanceAccountId) router.replace("/");
  }, [hydrated, pendingBalanceAccountId, router]);

  if (!hydrated || !pendingBalanceAccountId) return null;

  const handleSaveBalance = async () => {
    if (account && expr.trim() !== "") {
      const amount = evaluateKeypadExpression(expr, account.currencyCode, numberLocaleForUiLocale(locale));
      await accountsRepo.update(account.id, { openingBalance: amount.amount, currentBalance: amount.amount });
      invalidateAccounts();
    }
    // Ya instalada — nada que ofrecer. Pasa con el flujo (`isStandalonePwa()`
    // cubre tanto "la instaló antes" como "abrió este onboarding desde
    // dentro de la app ya instalada").
    if (installState?.standalone) {
      finish();
      return;
    }
    setStep("install");
  };

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

  const finish = () => {
    reset();
    router.push("/");
  };

  if (step === "balance") {
    return (
      <ScreenShell style={{ padding: "16px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 20 }}>
        <div style={{ textAlign: "center" }}>
          <h1 className="t-title" style={{ margin: 0 }}>{t("onboarding.complete.balanceTitle", { account: account?.name ?? t("onboarding.complete.yourAccount") })}</h1>
          <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 8 }}>
            {t("onboarding.complete.balanceSubtitle")}
          </p>
        </div>
        <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 32 }}>
          {account?.currencyCode ?? ""} {expr || "0"}
        </div>
        <Keypad onKey={(k) => setExpr((s) => (k === "backspace" ? s.slice(0, -1) : s + (k === "," ? "," : k)))} onClear={() => setExpr("")} />
        <div style={{ marginTop: "auto" }}>
          <Button onClick={handleSaveBalance}>{t("onboarding.complete.continue")}</Button>
        </div>
      </ScreenShell>
    );
  }

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
