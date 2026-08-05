"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, Icon, Input, Logo, ZMark } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { seedDemoHousehold } from "@/lib/seed/demo-household";
import { clearDemoCookie, enterDemoMode, isDemoModeActive } from "@/lib/demo/demo-mode";
import { useInvalidateHousehold } from "@/hooks/use-current-household";
import { useEmailField } from "@/hooks/use-email-field";
import { purgeNavigationCaches } from "@/lib/pwa/navigation-caches";
import { createClient } from "@/lib/supabase/client";
import { parseAuthHash } from "@/lib/auth/hash-tokens";
import { profilesRepo } from "@/lib/repos/profiles-repo";
import { resolveOnboardingDestination } from "@/lib/onboarding/resolve-destination";
import { markRegistered } from "@/lib/auth/registered-cookie";
import { hasSeenWelcome } from "@/lib/onboarding/welcome-flag";
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
  const email = useEmailField();
  const [seeding, setSeeding] = useState(false);
  const [sending, setSending] = useState(false);

  /**
   * El link del mail de verificación termina acá con los tokens en el
   * fragment (flujo implícito del verify de GoTrue — ver
   * `lib/auth/hash-tokens.ts`): el proxy no puede verlos (el fragment no
   * viaja al servidor) y el cliente PKCE no los consume solo, así que sin
   * este efecto la pantalla volvía a pedir el email a alguien que YA
   * verificó. Consume los tokens, y si hay sesión (por esto o de antes),
   * salta A2 hacia donde corresponda: `/pending` sin aprobación del
   * operador, la app si ya hay household local, o A4 para seguir el
   * registro.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const fromLink = parseAuthHash(window.location.hash);
      const searchError = new URLSearchParams(window.location.search).get("error");
      if (fromLink || searchError) {
        // Limpia URL antes de cualquier await: un remount no debe reprocesarla.
        window.history.replaceState(null, "", window.location.pathname);
      }

      if (fromLink?.kind === "error" || searchError) {
        toast.error(t("onboarding.auth.linkError"));
        if (!fromLink || fromLink.kind === "error") return;
      }

      if (fromLink?.kind === "tokens") {
        const { error } = await supabase.auth.setSession({
          access_token: fromLink.accessToken,
          refresh_token: fromLink.refreshToken,
        });
        if (error) {
          toast.error(t("onboarding.auth.linkError"));
          return;
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        // AC-6 — A1 (welcome) solo en la primera apertura de este navegador,
        // sin sesión y sin venir de un link del mail (ahí el aviso/flujo de
        // A2 manda). La decisión vivía en el layout del shell, donde quedó
        // como código muerto desde que el gate retiene el render (AC-18).
        if (!fromLink && !searchError && !hasSeenWelcome()) router.replace("/onboarding/welcome");
        return;
      }

      const access = await profilesRepo.getOwnAccess(user.id);
      if (cancelled) return;
      if (access && access.accessStatus !== "approved") {
        router.replace("/pending");
        return;
      }

      // Venía del demo y se registró: la cookie muere acá; el wipe de la
      // base anónima con los datos de ejemplo lo hace `DbOwnerSync` al ver
      // la sesión real (es quien sabe qué base está activa).
      if (isDemoModeActive()) {
        clearDemoCookie();
        router.replace("/onboarding/country");
        return;
      }

      // AC-8 — si hay sesión, en este dispositivo YA hubo una cuenta: sin
      // la marca, al vencer la sesión el proxy volvía a mostrar la pantalla
      // de alta en vez de /login.
      markRegistered();
      // Mismo motivo que en `/login`: lo navegado sin sesión quedó
      // cacheado como el redirect a esta pantalla, y sin tirarlo el
      // service worker puede devolver acá a alguien que ya entró.
      await purgeNavigationCaches();
      if (cancelled) return;

      // AC-9 — `resolveOnboardingDestination` consulta el servidor y puede
      // fallar (sin red, proyecto pausado). Nunca degradar en silencio a
      // A4: ese es el camino que crea un household duplicado. Se avisa y el
      // usuario se queda acá, con la pantalla utilizable.
      try {
        const destination = await resolveOnboardingDestination();
        if (cancelled) return;
        router.replace(destination);
      } catch {
        if (!cancelled) toast.error(t("onboarding.auth.checkError"));
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOAuth = async (provider: "google" | "apple") => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/onboarding/country` },
    });
    if (error) toast.error(error.message);
  };

  const handleMagicLink = async () => {
    if (!email.valid || sending) return;
    setSending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.value,
        options: {
          shouldCreateUser: true,
          // C7/proxy — sin esto GoTrue arma el link con el `site_url` pelado
          // (`supabase/config.toml`), que vuelve como `?code=` a la raíz y
          // nunca pasa por el canje de `/auth/callback`. `next` manda al
          // registro nuevo (nombre + contraseña), no directo a A4.
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding/register`,
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setField("email", email.value);
      router.push("/onboarding/verify");
    } finally {
      setSending(false);
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

        <Input placeholder={t("onboarding.auth.emailPlaceholder")} {...email.bind} />

        <Button disabled={!email.valid || sending} icon="mail" onClick={handleMagicLink}>
          {sending ? t("onboarding.auth.sendingLink") : t("onboarding.auth.sendLink")}
        </Button>

        {/* AC-7 — el camino al login (y desde ahí a "olvidé mi contraseña")
            no existía desde esta pantalla: quien entraba a la app en un
            dispositivo nuevo veía solo la pantalla de alta. */}
        <button
          type="button"
          onClick={() => router.push("/login")}
          style={{ background: "none", border: 0, cursor: "pointer", color: "var(--text-secondary)", fontSize: 13, alignSelf: "center" }}
        >
          {t("onboarding.auth.haveAccount")}
        </button>

        {/* El invitado que no tiene el link a mano (se lo dictaron, o lo
            perdió) no tenía cómo llegar a `/join` desde ningún lado. */}
        <button
          type="button"
          onClick={() => router.push("/join")}
          style={{ background: "none", border: 0, cursor: "pointer", color: "var(--text-secondary)", fontSize: 13, alignSelf: "center" }}
        >
          {t("onboarding.auth.haveInviteCode")}
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
