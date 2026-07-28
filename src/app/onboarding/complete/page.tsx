"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, Icon, Keypad } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { useOnboardingHydrated, useOnboardingStore } from "@/stores/onboarding-store";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccount, useInvalidateAccounts } from "@/hooks/use-accounts";
import { accountsRepo } from "@/lib/repos/accounts-repo";
import { evaluateKeypadExpression } from "@/lib/money/keypad";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

function isIos(): boolean {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * A7 + A10 — fuera del camino crítico: se piden acá, después del primer
 * gasto real (`docs/03-prompts-wireframes.md` § A7/A10). El primer contacto
 * de verdad con el keypad ya pasó en C1; esto solo completa el saldo.
 */
export default function OnboardingCompletePage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const hydrated = useOnboardingHydrated();
  const pendingBalanceAccountId = useOnboardingStore((s) => s.draft.pendingBalanceAccountId);
  const reset = useOnboardingStore((s) => s.reset);
  const { data: account } = useAccount(pendingBalanceAccountId ?? undefined);
  const invalidateAccounts = useInvalidateAccounts(household?.id);
  const [step, setStep] = useState<"balance" | "install">("balance");
  const [expr, setExpr] = useState("");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (hydrated && !pendingBalanceAccountId) router.replace("/");
  }, [hydrated, pendingBalanceAccountId, router]);

  if (!hydrated || !pendingBalanceAccountId) return null;

  const handleSaveBalance = async () => {
    if (account && expr.trim() !== "") {
      const amount = evaluateKeypadExpression(expr, account.currencyCode);
      await accountsRepo.update(account.id, { openingBalance: amount.amount, currentBalance: amount.amount });
      invalidateAccounts();
    }
    setStep("install");
  };

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      setInstallPrompt(null);
    }
    finish();
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
      {installPrompt ? (
        <p className="t-body" style={{ color: "var(--text-secondary)", maxWidth: "32ch" }}>
          {t("onboarding.complete.installPromptAvailable")}
        </p>
      ) : isIos() ? (
        <p className="t-body" style={{ color: "var(--text-secondary)", maxWidth: "32ch" }}>
          {t("onboarding.complete.installPromptIos")}
        </p>
      ) : (
        <p className="t-body" style={{ color: "var(--text-secondary)", maxWidth: "32ch" }}>
          {t("onboarding.complete.installPromptOther")}
        </p>
      )}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        {installPrompt ? <Button onClick={handleInstall}>{t("onboarding.complete.install")}</Button> : null}
        <Button variant={installPrompt ? "secondary" : "primary"} onClick={() => { toast(t("onboarding.complete.laterToast")); finish(); }}>
          {t("onboarding.complete.later")}
        </Button>
      </div>
    </ScreenShell>
  );
}
