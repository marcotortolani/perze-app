"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Input, ZMark } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { createClient } from "@/lib/supabase/client";
import { setOwnPassword, translateAuthError } from "@/features/auth/password-auth";
import { PASSWORD_PATTERN } from "@/features/auth/password-rules";
import { markRegistered } from "@/lib/auth/registered-cookie";
import { resolveOnboardingDestination } from "@/lib/onboarding/resolve-destination";

/**
 * C7 — último paso de recuperación. Requiere la sesión de `type=recovery`
 * que `auth/callback/route.ts` ya deja puesta al canjear el link de
 * `/forgot-password`; sin esa sesión (link vencido, ya usado, o alguien
 * que llegó acá directo) vuelve a pedir un link nuevo.
 */
export default function ResetPasswordPage() {
  const t = useTranslations();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        router.replace("/forgot-password?error=link_vencido");
        return;
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const passwordValid = PASSWORD_PATTERN.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = passwordValid && passwordsMatch && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await setOwnPassword(password);
      if (result.errorCode) {
        setError(translateAuthError(result, t as (key: string) => string));
        return;
      }
      markRegistered();
      // Mismo criterio que /login: dispositivo con datos → app; dispositivo
      // nuevo → restauración. El caso que rompía en producción (loop
      // /login ↔ /) era exactamente este redirect a "/" a secas.
      try {
        router.replace(await resolveOnboardingDestination());
      } catch {
        router.replace("/");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <ScreenShell style={{ alignItems: "center", justifyContent: "center" }}>
        <ZMark size={16} gap={5} animated variant="sweep" aria-label={t("app.name")} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell style={{ padding: "48px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 24 }}>
      <div>
        <h1 className="t-title" style={{ margin: 0 }}>{t("resetPassword.title")}</h1>
        <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 8 }}>
          {t("resetPassword.subtitle")}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Input
          label={t("resetPassword.passwordLabel")}
          type="password"
          autoComplete="new-password"
          placeholder={t("resetPassword.passwordPlaceholder")}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          autoFocus
          revealable
          revealLabels={{ show: t("resetPassword.showPassword"), hide: t("resetPassword.hidePassword") }}
          invalid={password.length > 0 && !passwordValid}
          hint={password.length > 0 && !passwordValid ? t("resetPassword.passwordRequirements") : undefined}
        />
        <Input
          label={t("resetPassword.confirmPasswordLabel")}
          type="password"
          autoComplete="new-password"
          placeholder={t("resetPassword.confirmPasswordPlaceholder")}
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setError(null);
          }}
          revealable
          revealLabels={{ show: t("resetPassword.showPassword"), hide: t("resetPassword.hidePassword") }}
          invalid={confirmPassword.length > 0 && !passwordsMatch}
          hint={confirmPassword.length > 0 && !passwordsMatch ? t("resetPassword.passwordMismatch") : undefined}
        />
        {error ? (
          <p className="t-label" style={{ color: "var(--critical)" }} role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div style={{ marginTop: "auto" }}>
        <Button size="lg" disabled={!canSubmit} onClick={handleSubmit}>
          {submitting ? t("resetPassword.submitting") : t("resetPassword.submit")}
        </Button>
      </div>
    </ScreenShell>
  );
}
