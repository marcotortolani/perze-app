"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, Icon, Input, Logo, ZMark } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { seedDemoHousehold } from "@/lib/seed/demo-household";
import { enterDemoMode } from "@/lib/demo/demo-mode";
import { useInvalidateHousehold } from "@/hooks/use-current-household";
import { createClient } from "@/lib/supabase/client";
import { signInWithPassword } from "@/features/auth/password-auth";
import { profilesRepo } from "@/lib/repos/profiles-repo";
import { env } from "@/env";

/**
 * A2 — auth. `CLAUDE.md` § "Orden de A2": con OAuth registrado, Google/Apple
 * son primarios y el email colapsa; sin OAuth, el email es el campo
 * primario y esos botones **no se dibujan** (ausentes, no deshabilitados —
 * un botón muerto sin credenciales se lee como una app rota). Este
 * self-host todavía no tiene apps de Google/Apple registradas en Supabase
 * Auth, así que hoy es la rama sin OAuth. El día que se configuren,
 * `NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS` (env, no un toggle en código) es lo
 * único que hay que tocar acá.
 */
const OAUTH_PROVIDERS = (env.NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS ?? "")
  .split(",")
  .map((p) => p.trim())
  .filter((p): p is "google" | "apple" => p === "google" || p === "apple");

export default function OnboardingAuthPage() {
  const t = useTranslations();
  const router = useRouter();
  const setField = useOnboardingStore((s) => s.setField);
  const invalidateHousehold = useInvalidateHousehold();
  const [email, setEmail] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [sending, setSending] = useState(false);
  // §1 — contraseña como ALTERNATIVA al código, nunca el default: arranca
  // siempre en modo código (`usePassword = false`), y quien ya se definió
  // una contraseña en Ajustes → Seguridad puede tocar "Prefiero usar mi
  // contraseña" para saltarse la espera del email.
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleOAuth = async (provider: "google" | "apple") => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/onboarding/country` },
    });
    if (error) toast.error(error.message);
  };

  const handleMagicLink = async () => {
    if (!emailValid || sending) return;
    setSending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setField("email", email);
      router.push("/onboarding/verify");
    } finally {
      setSending(false);
    }
  };

  const handlePasswordSignIn = async () => {
    if (!emailValid || !password || signingIn) return;
    setSigningIn(true);
    setPasswordError(null);
    try {
      const { error } = await signInWithPassword(email, password);
      if (error) {
        setPasswordError(error);
        return;
      }
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const access = user ? await profilesRepo.getOwnAccess(user.id) : null;
      if (access && access.accessStatus !== "approved") {
        router.push("/pending");
        return;
      }
      router.push("/onboarding/country");
    } finally {
      setSigningIn(false);
    }
  };

  const handleDemo = async () => {
    setSeeding(true);
    try {
      await seedDemoHousehold();
      enterDemoMode();
      invalidateHousehold();
      router.push("/");
    } catch {
      toast.error(t("onboarding.auth.demoError"));
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

      <div style={{ flex: 1, display: "grid", placeItems: "center" }}>
        <ZMark size={32} gap={10} animated variant="sweep" aria-label={t("app.name")} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {OAUTH_PROVIDERS.includes("google") ? (
          <Button variant="secondary" icon="google" onClick={() => handleOAuth("google")}>
            {t("onboarding.auth.continueWithGoogle")}
          </Button>
        ) : null}
        {OAUTH_PROVIDERS.includes("apple") ? (
          <Button variant="secondary" icon="apple" onClick={() => handleOAuth("apple")}>
            {t("onboarding.auth.continueWithApple")}
          </Button>
        ) : null}

        {OAUTH_PROVIDERS.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("onboarding.auth.orWithEmail")}</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>
        ) : null}

        <Input
          type="email"
          autoComplete="email"
          placeholder={t("onboarding.auth.emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {usePassword ? (
          <Input
            type="password"
            autoComplete="current-password"
            placeholder={t("onboarding.auth.passwordPlaceholder")}
            value={password}
            invalid={!!passwordError}
            hint={passwordError ?? undefined}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError(null);
            }}
          />
        ) : null}

        {usePassword ? (
          <Button disabled={!emailValid || !password || signingIn} onClick={handlePasswordSignIn}>
            {signingIn ? t("onboarding.auth.signingIn") : t("onboarding.auth.signInWithPassword")}
          </Button>
        ) : (
          <Button disabled={!emailValid || sending} icon="mail" onClick={handleMagicLink}>
            {sending ? t("onboarding.auth.sendingLink") : t("onboarding.auth.sendLink")}
          </Button>
        )}

        <button
          type="button"
          onClick={() => {
            setUsePassword((v) => !v);
            setPasswordError(null);
          }}
          style={{ background: "none", border: 0, cursor: "pointer", color: "var(--text-secondary)", fontSize: 13, alignSelf: "center" }}
        >
          {usePassword ? t("onboarding.auth.preferCode") : t("onboarding.auth.preferPassword")}
        </button>
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
