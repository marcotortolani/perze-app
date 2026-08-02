"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Input, Logo } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { createClient } from "@/lib/supabase/client";
import { signInWithPassword, translateAuthError } from "@/features/auth/password-auth";
import { profilesRepo } from "@/lib/repos/profiles-repo";
import { markRegistered } from "@/lib/auth/registered-cookie";
import { resolveOnboardingDestination } from "@/lib/onboarding/resolve-destination";

/**
 * C7 — solución de transición (ver `docs/mejora-auth-oauth-y-email.md`):
 * destino de quien ya se registró (`perze_registered` presente, sin
 * sesión viva — `src/proxy.ts`). No está en el diseño de A2, que asume
 * login/signup indistinguibles sin contraseña; acá sí hace falta
 * distinguirlos porque el registro (`/onboarding/register`) ya fijó una.
 */
export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = emailValid && password.length > 0 && !signingIn;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSigningIn(true);
    setError(null);
    try {
      const result = await signInWithPassword(email, password);
      if (result.errorCode) {
        setError(translateAuthError(result, t as (key: string) => string));
        return;
      }
      markRegistered();
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const access = user ? await profilesRepo.getOwnAccess(user.id) : null;
      if (access && access.accessStatus !== "approved") {
        router.replace("/pending");
        return;
      }
      // AC-1 — con household local va directo a la app; en un dispositivo
      // nuevo va a `/onboarding/restore` a bajar sus datos, sin pasar por
      // la pantalla de alta. Si el chequeo falla, "/" deja que el gate
      // reintente por el camino normal.
      try {
        router.replace(await resolveOnboardingDestination());
      } catch {
        router.replace("/");
      }
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <ScreenShell style={{ padding: "48px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 32 }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ margin: 0 }}>
          <Logo style={{ fontSize: "var(--text-title-size)" }} />
        </h1>
        <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 8 }}>
          {t("login.subtitle")}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Input
          type="email"
          autoComplete="email"
          placeholder={t("login.emailPlaceholder")}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          autoFocus
        />
        <Input
          type="password"
          autoComplete="current-password"
          placeholder={t("login.passwordPlaceholder")}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          revealable
          revealLabels={{ show: t("login.showPassword"), hide: t("login.hidePassword") }}
          invalid={!!error}
          hint={error ?? undefined}
        />

        <Button disabled={!canSubmit} onClick={handleSubmit}>
          {signingIn ? t("login.signingIn") : t("login.submit")}
        </Button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => router.push("/forgot-password")}
          style={{ background: "none", border: 0, cursor: "pointer", color: "var(--text-secondary)", fontSize: 13 }}
        >
          {t("login.forgotPassword")}
        </button>
        <button
          type="button"
          onClick={() => router.push("/onboarding")}
          style={{ background: "none", border: 0, cursor: "pointer", color: "var(--text-muted)", fontSize: 13 }}
        >
          {t("login.createAccount")}
        </button>
      </div>
    </ScreenShell>
  );
}
