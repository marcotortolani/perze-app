"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, Input, ZMark } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { createClient } from "@/lib/supabase/client";
import { setOwnPassword, translateAuthError } from "@/features/auth/password-auth";
import { PASSWORD_PATTERN } from "@/features/auth/password-rules";
import { profilesRepo } from "@/lib/repos/profiles-repo";
import { resolveOnboardingDestination } from "@/lib/onboarding/resolve-destination";
import { markRegistered } from "@/lib/auth/registered-cookie";

/**
 * C7 — solución de transición (ver `docs/mejora-auth-oauth-y-email.md`):
 * destino real del link de verificación (`/auth/callback?next=/onboarding/register`).
 * El diseño (A2/A4, `docs/design/bloque-a-onboarding.html`) dice "no hay
 * contraseñas, ni acá ni nunca" — esta pantalla no está en ese diseño y
 * existe solo mientras no haya Google Auth + Resend con plantilla propia.
 * País y moneda NO se piden acá: siguen siendo A4 (`/onboarding/country`),
 * que ya existe y ya funciona.
 */
export default function OnboardingRegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/onboarding");
        return;
      }

      const access = await profilesRepo.getOwnAccess(user.id);
      if (cancelled) return;
      if (access && access.accessStatus !== "approved") {
        router.replace("/pending");
        return;
      }

      const alreadyRegistered = await profilesRepo.getRegistrationCompletedAt(user.id);
      if (cancelled) return;
      if (alreadyRegistered) {
        markRegistered();
        // AC-9 — si el chequeo remoto falla, cae al formulario (recuperable:
        // re-fijar la contraseña es inocuo y el envío re-resuelve destino).
        try {
          const destination = await resolveOnboardingDestination();
          if (cancelled) return;
          router.replace(destination);
          return;
        } catch {
          if (cancelled) return;
          toast.error(t("onboarding.auth.checkError"));
        }
      }

      userId.current = user.id;
      setEmail(user.email ?? "");
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nameValid = name.trim().length > 0;
  const passwordValid = PASSWORD_PATTERN.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = nameValid && passwordValid && passwordsMatch && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !userId.current) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await setOwnPassword(password);
      if (result.errorCode) {
        setError(translateAuthError(result, t as (key: string) => string));
        return;
      }
      await profilesRepo.updateDisplayName(userId.current, name.trim());
      await profilesRepo.markRegistrationCompleted(userId.current);
      markRegistered();
      // Para un alta nueva esto resuelve a A4; para una cuenta que ya tiene
      // household remoto (p. ej. registro re-abierto en otro dispositivo),
      // a la restauración — nunca al camino que duplica households.
      router.replace(await resolveOnboardingDestination());
    } catch {
      toast.error(t("onboarding.register.genericError"));
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
        <h1 className="t-title" style={{ margin: 0 }}>{t("onboarding.register.title")}</h1>
        <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 8 }}>
          {t("onboarding.register.subtitle")}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Input label={t("onboarding.register.nameLabel")} placeholder={t("onboarding.register.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <Input label={t("onboarding.register.emailLabel")} value={email} readOnly />
        <Input
          label={t("onboarding.register.passwordLabel")}
          type="password"
          autoComplete="new-password"
          placeholder={t("onboarding.register.passwordPlaceholder")}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          revealable
          revealLabels={{ show: t("onboarding.register.showPassword"), hide: t("onboarding.register.hidePassword") }}
          invalid={password.length > 0 && !passwordValid}
          hint={password.length > 0 && !passwordValid ? t("onboarding.register.passwordRequirements") : undefined}
        />
        <Input
          label={t("onboarding.register.confirmPasswordLabel")}
          type="password"
          autoComplete="new-password"
          placeholder={t("onboarding.register.confirmPasswordPlaceholder")}
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setError(null);
          }}
          revealable
          revealLabels={{ show: t("onboarding.register.showPassword"), hide: t("onboarding.register.hidePassword") }}
          invalid={confirmPassword.length > 0 && !passwordsMatch}
          hint={confirmPassword.length > 0 && !passwordsMatch ? t("onboarding.register.passwordMismatch") : undefined}
        />
        {error ? (
          <p className="t-label" style={{ color: "var(--critical)" }} role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div style={{ marginTop: "auto" }}>
        <Button size="lg" disabled={!canSubmit} onClick={handleSubmit}>
          {submitting ? t("onboarding.register.submitting") : t("onboarding.register.submit")}
        </Button>
      </div>
    </ScreenShell>
  );
}
